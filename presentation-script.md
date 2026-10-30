# Demo script

Speaking notes for [`public/presentation.html`](public/presentation.html).

**Runs about 18 minutes** for the slides plus the live demo, leaving room for questions in a
30-minute slot. Timings per slide are below; the ones marked *(cut if short)* can go without
breaking the thread.

This is a guide, not a teleprompter. The wording is written the way people actually talk —
short sentences, contractions — so read it once or twice and then say it in your own words.

---

## Before you start

- [ ] `npm run dev` running, browser at `http://localhost:5173`
- [ ] A **second tab** already on the app with the example loaded and **Compare all pages**
      already run — so the live demo doesn't stall on a spinner
- [ ] Deck open at `/presentation.html`, pressed `F` for full screen
- [ ] Terminal open in `cli/` in case someone asks to see the CLI run
- [ ] Know your escape hatch: if the live demo misbehaves, slide 7 has the same numbers in a
      table. Keep going, don't debug in front of the room.

---

## 1 · Title  — 45 sec

> So this is a tool I built for checking PDFs. The short version: you give it two documents,
> and it tells you what's different between them.
>
> That sounds simple, but the useful part isn't *that* something changed — it's *what kind*
> of change it was. Whether somebody edited the words, or changed a font, or something just
> moved. Those are three completely different problems and they need three different fixes.
>
> I'll show you how it works, then run it live, then go through what's under the hood.

---

## 2 · The problem  — 90 sec

> Here's why I built it.
>
> We change a template, we regenerate the documents, and then somebody opens a few pages and
> checks them by eye. That's the process. And it mostly works, until it doesn't — a font
> changes on page four and nobody catches it before it goes out.
>
> The problem isn't that people aren't careful. A six-page invoice has hundreds of separate
> pieces of text on it. Nobody checks all of them, twice, every release.

*(pause — this is the bit the room recognises)*

> And even when you do spot a difference, "these pages look different" isn't something you
> can act on. Was it a word? A font? Did a block move? Each one is a different fix in the
> template.
>
> Third thing — sometimes there's no reference document at all. New page, nothing to compare
> against. I'll come back to that one.

---

## 3 · Four workspaces  — 60 sec

> There are four parts to it.
>
> **Compare** is the main one — two documents, page by page.
>
> **Spec driven comparison** is for when you don't have a reference. You describe what should be on
> the page and it checks against that instead.
>
> **Utilities** is a small thing but people use it a lot — load one PDF, hover anything,
> and it tells you how far it is from the edges, or what font it's in.
>
> **Batch** is many documents at once.

*(don't dwell — say it and move on, you'll show Compare properly in a minute)*

> One thing worth saying: this all runs in the browser. Nothing gets uploaded anywhere. For
> our documents that matters.

---

## 4 · The pipeline  — 90 sec

> Quickly, how it actually works.
>
> It renders both pages to images. Then it pulls out every piece of text with its exact
> position, its font, its size. Then it matches text on one side to text on the other. Then
> it works out what kind of change each difference is. And then it scores the page against
> whatever thresholds you set.
>
> Two things I'd point out.
>
> One — everything gets measured in inches. That's deliberate. XDP templates use inches, so
> when the tool says something moved a quarter of an inch, that number goes straight into the
> template.
>
> Two — there's a pixel comparison running alongside the text comparison. That's what catches
> things with no text at all. A bar that changed colour, a line that moved. I'll show you a
> page like that.

---

## 5 · Three kinds of difference  — 2 min  ★ *the important slide*

> This is the core of it, so I'll go slowly.
>
> Every difference goes into exactly one of three buckets.
>
> **Content** — the words changed. And it tells you *which words*. Not "this line changed" —
> it says `approach` became `strategy`.
>
> **Style** — same words, but the font or the size or the weight changed.
>
> **Layout** — same words, same font, it just moved. And it gives you the correction, not the
> observation. It says "decrease y by a quarter inch", so you don't have to work out which
> direction.

*(point at the note at the bottom)*

> The rule underneath is this. If something qualifies for more than one bucket, content wins
> over style, and style wins over layout.
>
> Reason being — if you edit a word, that word gets wider or narrower, and everything after
> it shifts. If you report that as a layout change you've sent someone to fix the wrong
> thing. The edit is the cause. The shift is just what happened next.

---

## 6 · One word, bolded  — 2 min  ★ *the credibility slide*

> I want to show you why this is harder than it sounds, because this is a real bug I hit.
>
> We had a document where one word — "approach" — got bolded. Nothing else changed. And the
> tool reported it as a content change. Wrong bucket.

*(left panel)*

> Here's why. When a PDF has a font change in the middle of a line, the file doesn't store
> that line as one piece of text any more. It splits it. So side A has one chunk, and side B
> has three chunks, because of the bold word in the middle.
>
> So if you're comparing chunk to chunk, nothing matches. One chunk on the left, three on the
> right, and it looks like a whole sentence got deleted and three new ones appeared.

*(right panel)*

> That's the top half. Four content changes, all wrong.
>
> The bottom half is what it does now — one style change, on the word "approach", and it
> tells you Helvetica became Helvetica-Bold.
>
> The giveaway, by the way, was that the text-match score was already showing 100 percent.
> The text genuinely hadn't changed. The two halves of the tool were disagreeing with each
> other. That's what pointed at the bug.

---

## 7 · The example  — 90 sec, then go live  ★ *switch to the app here*

> There's an example built into the app. It's a six-page invoice against a five-page
> recreation, and it's deliberately nasty — every page breaks something different.
>
> Rather than read the table, let me just show you.

**→ Switch to the app tab.**

### Live demo — about 5 minutes

Work through it in this order. Say what you're clicking as you click it.

1. **Start on the empty state.** "One button, no upload." Click **Load example invoices**.

2. **Content tab, page 1.** "Every difference is boxed on both pages. Red is gone, green is
   new, cyan means restyled, violet means it moved." Hover a box — "the list underneath links
   to it, both directions."

3. **Page 2.** This is the money page. "Two things happened here — somebody edited a few
   cells, and somebody deleted a whole row. And when you delete a row, everything below it
   moves up." Point at the counts. "Eight actual edits. Thirty-one things that just moved
   because of them. Kept separate, so you're not hunting through thirty-one findings to find
   eight real ones."

4. **Layout tab → Pixel diff.** "Same page, different view." Point at the legend. "Amber is
   text, cyan is font, violet is moved." Hover an amber region — "before and after, full
   text, not cut off." Hover a violet one — "and for a move it gives you the distances."

5. **Page 4.** "This one has no text on it at all — it's a chart. Content match says a
   hundred percent. But the pixel comparison catches it. That's the case a text-only tool
   misses completely."

6. **Report tab.** "Set your thresholds here. This is the pass-fail." Point at a failing row.
   "And you click through to the page."

7. **Export menu.** Open it, don't run it. "Five formats. I'll come back to the last one."

**→ Back to the deck. Press `8`.**

---

## 8 · Test against a spec  — 60 sec  *(cut if short)*

> Back to the case where there's no reference document.
>
> You write down what should be on the page — this text here, this image this big, this table
> this wide — and it checks the PDF against that.
>
> The bit I'd flag is the anchor. An image has no text in it, so if you only give it
> coordinates, and the layout has shifted, it'll happily match the wrong image. An anchor ties
> it to a label that's actually on the page — "the logo is to the right of the title". Then it
> finds the right thing and *then* tells you the position is wrong.
>
> There's a spec document written up for the format. If you've got specs in Excel, that
> document is what you'd use to convert them.

---

## 9 · Reports  — 75 sec

> Five outputs.
>
> The HTML one is what you'd send someone — annotated pages, the heatmap, all the changes
> listed.
>
> JUnit XML is for Jenkins. It reads it natively, so you get per-page history and it tells you
> what newly broke.
>
> JSON and CSV, for scripts and spreadsheets.

*(point at the highlighted card)*

> And this last one I want to call out. It's a Markdown file, and it's written for an AI agent
> to read, not a person.
>
> Every finding comes with what to change in the *template*. Positions in inches, font sizes
> in points — the same units XDP uses. And the deltas are already the correction to apply, so
> the model doesn't have to work out signs.
>
> The other thing it does — if a deleted row shifted thirty things, it groups them. One
> finding, not thirty. Otherwise you'd have an agent making thirty individual coordinate
> edits, which is exactly what you don't want it doing.

---

## 10 · The CLI  — 90 sec

> Everything you just saw runs from the command line too.
>
> First command pulls the PDFs from the render API. Second one compares them and writes the
> reports.
>
> The thing I'd point at is the exit code. Zero means passed. One means the documents actually
> changed. Two means the tool itself failed — bad config, API down, something like that.
>
> That split matters. Without it, your pipeline can't tell "the documents regressed" from "the
> build is broken", and those need completely different responses.
>
> Worth saying — the CLI doesn't have its own copy of the comparison code. It imports the same
> code the app uses. So it can't give you a different answer than the screen does.

---

## 11 · The three main libraries  — 2 min

> On to what it's built from. Three libraries do the actual work.
>
> **pdf.js**, from Mozilla — this is the one everything depends on. It reads the PDF, draws
> each page to an image, and pulls out every piece of text with its position and its font.
> The font part is what makes bold and italic detection possible at all. It's also, as you
> saw, the thing that splits lines when the font changes.
>
> **pixelmatch**, from Mapbox — compares the two images pixel by pixel. It's got a threshold
> so it's not tripping on anti-aliasing. This is the one that catches changes with no text —
> the chart page.
>
> **jsdiff** — does the text comparison. Two uses: it scores the overall match percentage, and
> it produces the word-level list. That second one is why you get "approach became strategy"
> instead of the whole sentence twice.

---

## 12 · The rest of the stack  — 90 sec  *(cut if short)*

> Quickly, the rest.
>
> **React and TypeScript** for the interface. TypeScript's doing more than usual here — the
> comparison types are shared between the app, the CLI and the report writers, so if I change
> the model, it won't compile until all three agree.
>
> **Zustand** for state. Small thing, but it means one page's result finishing doesn't
> re-render the whole screen.
>
> **Vite** for the build.
>
> **napi-canvas** is the interesting one. The engine draws on a canvas, and there's no canvas
> in Node. This gives it one, so the exact same rendering code runs headlessly on a build
> agent. And it ships prebuilt, so you're not installing a compiler on your CI box.
>
> **esbuild** bundles the CLI and does the two bits of glue that let browser code run in Node.
>
> **Commander** for the command line, **Express** for a mock API so you can test the whole
> loop locally without a real backend.

---

## 13 · Architecture  — 60 sec

> This is the shape of it. One engine in the middle. The app and the CLI both sit on top
> of it.
>
> The engine is imported, not copied. That was a deliberate call — if I'd forked it, the CLI
> and the app could drift, and then you'd have the app saying pass and CI saying fail on the
> same document and no way to know which one's right.

---

## 14 · How we know it's right  — 90 sec  ★ *this is what earns trust*

> Last technical slide. Given I've just spent ten minutes telling you it sorts things into
> three buckets correctly — here's why I believe that.
>
> There are twenty-four test documents, each one built to isolate a single kind of change. A
> word edited. A word bolded. Something moved. And then every combination of those. And then
> the awkward ones — a change that causes other things to shift, the same text appearing
> twice with one copy restyled, a capitalisation change.
>
> Each one asserts which bucket it should land in. And separately it checks that no single
> element ever ends up in two buckets at once.
>
> All twenty-four pass. It runs as one command, so when somebody changes the classifier
> they'll know immediately if they broke it.

*(if you want one honest detail, use this — it lands well)*

> One of these found a real bug, actually. If a heading went from "Total Amount" to "TOTAL
> AMOUNT" — just capitalisation — the tool reported nothing at all. The page still failed on
> pixels, so you'd see a number move with no explanation for it. That's fixed, and there's now
> a test making sure it stays fixed.

---

## 15 · Close  — 45 sec

> That's it. It's two commands to run locally and there's an example built in, so it's about a
> minute to try.
>
> The docs are all in the repo and they all work offline — full manual, the CLI guide, and the
> spec format if you're writing specs.
>
> One thing I'd flag before anyone rolls this out widely — fonts. If a machine doesn't have a
> font the document uses, the renderer substitutes something else, and then every measurement
> shifts at once. So if we're running this in CI we should pin it to a container with a known
> set of fonts. Otherwise you get failures that have nothing to do with the documents.
>
> Happy to take questions.

---

## Likely questions

**"How accurate is it? What's the false positive rate?"**
> The three-way classification is covered by twenty-four tests and they all pass. What I'd be
> more careful about is fonts — if the machine running it doesn't have the right fonts, every
> number shifts and you get failures that aren't real. That's the thing to control, and it's
> environment, not the tool.

**"Can it handle scanned PDFs?"**
> Partly. There's no text layer in a scan, so the text comparison has nothing to work with —
> you'd only get the pixel comparison. It'll tell you the pages differ, not what changed.

**"Does it work on documents other than invoices?"**
> Nothing in it is invoice-specific. It reads text runs and positions. The example happens to
> be an invoice because that's what I had.

**"How long does it take?"**
> Rendering dominates. Roughly a second or two per page. The batch runs pages in sequence, so
> for a big set it's minutes, not seconds. Fine for CI, not something you'd want to sit and
> watch.

**"What if the two documents have different page counts?"**
> It flags the page as missing on one side and fails it. It doesn't try to guess which pages
> correspond — that's deliberate, guessing there would hide a real problem.

**"Can we plug it into our existing Jenkins?"**
> Yes. It's an exit code and a JUnit file, which is what Jenkins already understands. The API
> URL and credentials go in a config file so they're not in the job.

**"Why not just diff the PDF files directly?"**
> Two PDFs of the same content usually aren't byte-identical — timestamps, internal IDs, that
> sort of thing. You'd get differences on every single run. This compares what's actually
> rendered and what text is actually there.

**"Who maintains this?"** *(be honest, whatever the answer is)*
> Worth agreeing before it becomes something people depend on.

---

## If you're short on time

Cut slides **8** and **12**, and trim the live demo to page 2 and page 4 only. That's about
11 minutes and still covers the argument: here's the problem, here are the three buckets,
here's it working, here's how we know it's right.
