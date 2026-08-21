/* Reads the filed paper requests, newest first, for the admin page.

   Guarded by ADMIN_PASSWORD, set in the Netlify site's environment variables.
   With no password set the endpoint refuses to answer rather than falling open. */
import { getStore } from "@netlify/blobs";

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });

/* Compare without leaking the answer through how long it takes. */
function sameSecret(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export default async (req) => {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) {
    return json({ error: "ADMIN_PASSWORD is not set on this site." }, 500);
  }

  const given = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!sameSecret(given, expected)) return json({ error: "Wrong password." }, 401);

  try {
    const store = getStore("paper-requests");
    const { blobs } = await store.list();
    const keys = blobs.map((b) => b.key).sort().reverse();      // keys start with the timestamp
    const requests = await Promise.all(keys.map(async (key) => {
      const record = await store.get(key, { type: "json" });
      return record ? { key, ...record } : null;
    }));
    return json({ requests: requests.filter(Boolean) });
  } catch (err) {
    console.error("could not read the requests", err);
    return json({ error: "The requests could not be read." }, 500);
  }
};
