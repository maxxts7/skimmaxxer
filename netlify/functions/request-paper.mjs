/* Takes a request for a paper and files it in the "paper-requests" blob store.
   Two kinds of request arrive here, told apart by `forPaperId`:
     - a paper already in the register, asked to be read in full
     - a paper nobody has touched yet, proposed by its arXiv link or id
   Nothing is shown publicly, so this only ever writes. */
import { getStore } from "@netlify/blobs";

const LIMITS = { paper: 300, note: 2000, email: 200, name: 120 };

const clean = (v, max) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });

export default async (req) => {
  if (req.method !== "POST") return json({ error: "Use POST." }, 405);

  let body;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Send JSON." }, 400);
  }

  // A field no person fills in. Bots do.
  if (clean(body.website, 100)) return json({ ok: true });

  const record = {
    paper: clean(body.paper, LIMITS.paper),
    note: clean(body.note, LIMITS.note),
    email: clean(body.email, LIMITS.email),
    name: clean(body.name, LIMITS.name),
    forPaperId: clean(body.forPaperId, 60) || null,
    forPaperTitle: clean(body.forPaperTitle, LIMITS.paper) || null,
    createdAt: new Date().toISOString(),
  };

  if (!record.paper && !record.forPaperId) {
    return json({ error: "Name a paper: a link, an arXiv id, or a title." }, 400);
  }
  if (record.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(record.email)) {
    return json({ error: "That email address does not look right." }, 400);
  }

  /* Key sorts by time, so listing newest-first is a reverse of the keys. The
     random tail keeps two requests in the same millisecond apart. */
  const key = record.createdAt.replace(/[:.]/g, "-") + "-" +
    Math.random().toString(36).slice(2, 8);

  try {
    const store = getStore("paper-requests");
    await store.setJSON(key, record);
  } catch (err) {
    console.error("could not file the request", err);
    return json({ error: "The request could not be filed. Try again shortly." }, 500);
  }

  return json({ ok: true });
};
