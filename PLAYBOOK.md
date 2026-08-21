# Playbook — What Happens When A Paper Arrives

The companion to [DESIGN.md](DESIGN.md). That one says what the finished thing has to be; this one
walks through how you get there.

The whole flow in a breath: **you pull the figures and text out of the PDF, run agents over the
text to extract the concepts, scope any cited paper the concepts lean on, then use agents to find
the edges between everything and group it into themes. Once that's settled you fan out agents to
write the concept and theme pages. When those come back you write the main story, then fan out
again to grow that story downward, and once more for a second read built on the edges.**

Everything below is that sentence, slowed down.

---

## Before you start: set the floor

One decision has to be made before any of it, because everything downstream inherits it: **who is
reading this, and what do they already know?**

Write it as a sentence you could hand to an agent, and make it name both sides — what to assume,
and what to explain anyway. "An ML practitioner" is not enough; a practitioner knows softmax but
probably doesn't remember how BLEU is actually computed.

The test: pick three terms from the paper's method section. If you can't immediately say which side
of the floor each falls on, the floor is too vague to use.

Four smaller choices come with it, and all four can be changed later: which lenses to look for
relationships through (four work well), how deep the narrative may recurse (three is plenty), how
slow the prose should read, and how far to follow citations (one level).

## 1. Get everything out of the PDF

This part is scripts, not agents. You end up with the paper split into per-section text, a rendered
image of every page, and a cropped image of every figure and table with its caption.

Equations are handled differently. They get no crop, because they're re-typeset later, so instead
they're inventoried — the three to eight displayed equations that actually carry weight, not every
inline formula.

**Then look at the crops with your own eyes.** This is the most important manual moment in the
whole process. Every stage after this one reads this output, and not one of them can tell that a
figure got cut in half or that a table crop stopped after the header row. If the section list comes
out as one giant blob instead of twenty sections, the heading detector didn't fire on this layout
and you fix that here.

## 2. Run agents over the text to extract the concepts

Split the sections into three groups by role — roughly framing, method, experiments — and give one
agent each. They pull out every concept a reader would need: terms, mechanisms, design choices,
named quantities. Concepts nest, so a concept too big to explain in one breath gets children, and
that keeps going until each one bottoms out at the floor you set.

A fourth agent then merges the three. It dedups the overlaps, makes sure every prerequisite
actually exists, breaks any cycles, and decides which concepts are big enough to deserve their own
page.

**Read that list of major concepts before going further.** Twelve to twenty of them, and they're
about to become thirty-odd pages and the spine of both narratives. Read it like a table of contents
for the paper. Anything missing, anything in there that isn't really load-bearing? This is the
cheapest place in the whole process to fix a structural problem.

## 3. If a concept belongs to a cited paper, go and scope that paper too

The merge also flags citations worth chasing. The rule for keeping one is narrow:

> Does this paper **use a mechanism** from the cited work, or does it merely **compare against it**?

Follow the first, never the second. A baseline you're scored against isn't a prerequisite; a
tokenizer you adopt wholesale is. Three to six is normal.

Each kept citation gets fetched and read by its own agent — but narrowly. Only the concepts the
citing paper actually needs, written so they stand on their own without reference to whoever cited
them, and stored under that paper rather than under yours. That's what makes them reusable later.
Each read also reports what it deliberately skipped.

## 4. Now the figures can be made self-sufficient

This waits for the concepts, because each figure agent needs the concept list to link into.

One agent per figure, table and equation. It defines every term, symbol, axis, legend entry and
column header in the thing, explains every number, and states what the item establishes.

The test is literal: cover the paper, read only the item page, and see whether you can interpret
any cell of that table or name every box in that diagram.

## 5. Find the edges, then group everything into themes

Four agents look at the whole set — concepts, figures, results — each through one lens: what
depends on what, which claims the evidence actually backs, what is an instance of what, and what
trades off against what. Each edge they find carries its own explanation of why it exists.

Then two more agents group things: one sorts the concepts into themes, the other sorts the edges
into edge-themes — the arguments those edges collectively make.

Glance at the spread across the four lenses. Roughly even is healthy; one lens returning double the
others usually means its brief was too broad and the extra edges are weak.

## 6. Fan out to write the pages

Everything the pages need now exists, so this is the big parallel step. One agent per major
concept, per theme, and per edge-theme — thirty-plus at once.

Each gets a brief holding exactly what its page needs: the draft material, the neighbours, every
relationship touching it, the evidence, and which sections to read. None of them reads the whole
dataset.

The three page types do different jobs. A concept page explains a mechanism concretely enough to
teach it. A theme page is the connective tissue between its members, not a summary of each. An
edge-theme page states an argument and traces it end to end — that's where a reader learns what the
paper *didn't* prove.

**Read two of the thirty before accepting all of them.** You're not checking accuracy, which the
gate covers; you're checking register. If two are wrong in the same way, all thirty are, and it's a
prompt fix rather than an editing job.

## 7. Write the main story

One agent, with everything above in front of it, writes the front door: the paper retold start to
finish, in seven to nine chapters, following the themes' reading order as its spine.

It has to work two ways at once. As a continuous read for someone who sees nothing else, and as a
hub — every loaded term is a link, so a reader who wants more clicks through and comes back. The
last chapter is the honest accounting of what the paper established and what it didn't.

## 8. Fan out again to grow the story downward

Now the recursion. Every chapter of that story gets an agent that retells *the same span* at higher
resolution, as its own small narrative with its own chapters. Then each of those chapters decides
whether it still holds enough distinct material to be worth expanding again, and the ones that do
get another round.

It stops on its own — when nothing declares more depth, or at the depth cap. Expect the branches to
come out uneven, because papers are uneven. Be suspicious if everything wants maximum depth; that's
usually padding.

The one thing to check: pick a child and its parent, and confirm the child genuinely goes deeper.
A child that restates its parent in different words is the characteristic failure here, and it
means that branch shouldn't have expanded at all.

## 9. Then the second read

The edges are the most interesting thing in the dataset and nobody will find them in a reference
list. So one more narrative, spined on them: an agent reads every relationship and writes chapters
that each state one insight — something you can only see when several connections sit side by side,
like a chain of forced choices nobody states in one place, or the gap between what a paper asserts
and what it measures.

Chapters that need it expand the same way as before. Each one carries its raw edges underneath it,
and the whole thing reports which relationships it left unused.

## 10. Finish, then read it

The last passes are scripts: attach a citation to every surface pointing at the page of the PDF it
came from, sweep for concepts that got named in prose but never linked, bundle everything, and run
the quality gate.

Then do the one check nothing automated can do. **Open the front page and read it the way a reader
would.** Follow a link. Zoom into a chapter. Come back out. Look something up. You're hunting for
what passes every check and is still wrong — a link that lands somewhere unhelpful, a chapter that
ends without pointing anywhere, a page that assumes you read the previous one.

---

## Judgment calls that keep coming up

**Major or minor concept?** Major if a reader would look it up on its own; minor if it only makes
sense inside its parent. When unsure, minor — it still renders, as an expandable section, and
promoting it later is cheap.

**Expand this branch?** Only if it holds several distinct strands each deserving their own telling.
When unsure, don't. A shallow honest branch beats a padded deep one.

**Follow this citation?** Only if a mechanism is borrowed. Comparison isn't borrowing.

**Has the tone drifted?** The rules push toward skepticism, which is usually right and occasionally
too far. Separating what a paper measured from what it asserted is the job. Implying the work is
weak because its evidence has limits is not.

**Regenerate or rewrite?** Rewrite, nearly always. The researched content is expensive and already
verified; style is cheap. Regenerating to fix tone throws away work that was correct.

## When a problem means going back

Some failures are symptoms of a decision made earlier, and pushing forward makes them worse.

| What you see | What's actually wrong |
|---|---|
| Everything is over-explained | Floor set too low |
| Terms get named but never unpacked | Floor set too high |
| Pages restate their own summaries | Briefs aren't saying what renders where |
| Every branch wants maximum depth | Agents padding; tighten the expand instruction |
| Vague edges — "X is related to Y" | Lens briefs too broad |
| Narrative children restate parents | Expansion happening where it shouldn't |
| Two branches explain the same thing | Expected; decide whether to accept or dedup |



One consequence worth planning around: **decide how slow the prose should read before the page
fan-out.** Changing your mind afterwards means re-pacing everything, which costs more than every
other stage combined. It's recoverable — there's a stage for exactly that — but it's the one
expensive mistake in the sequence.
