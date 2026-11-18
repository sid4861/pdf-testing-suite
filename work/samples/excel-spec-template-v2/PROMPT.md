# The conversion prompt

Paste everything below the line into any AI agent, together with:

1. **`TEMPLATE-V2-STRUCTURE.md`** from this folder — attach it, or paste it after the prompt.
2. **The spec you want converted** — an `.xlsx`, `.docx`, a PDF, notes, whatever it is.

Optionally also attach `report-spec.xlsx` from this folder as a shape reference. It is a
clean, fictional example; everything in it is invented.

The prompt assumes the agent can run code and write files. If yours cannot, add the line
*"You cannot run code: output the script and each sheet as a Markdown table instead."*

---

You are converting an existing design specification into the **Template v2** workbook format
used by pdfsuite, so that a report PDF can be checked against it automatically.

`TEMPLATE-V2-STRUCTURE.md` is attached. It is the authority on the format. Read all of it
before you write anything. Where this prompt and that file disagree, that file wins.

## The one rule that governs everything

**Never guess.** The reader that consumes your output refuses any row it cannot read exactly,
and tells a human which cell to fix. That is the designed behaviour, and it is much better
than the alternative: a value you inferred becomes a confident finding about a document that
was actually fine.

So, concretely:

- If the source gives a number but no unit, **do not supply one**. Leave `Unit` blank and
  list the row in your report as needing a human.
- If the source says "about 10", "roughly a third down", "~0.5in", do not turn it into a
  measurement. Set `Check?` to `Note` and put the source's words in `Notes`.
- If the source uses pixels and states no pixels-per-inch, **do not assume 72, 96 or 144**.
  Either leave `Settings!Pixels per inch` blank and accept that those rows will be refused,
  or convert the values to a physical unit *only if the source itself states the conversion*.
- If you cannot tell which element a statement belongs to, make it its own `Note` row rather
  than attaching it to an element you picked.

A smaller workbook that is entirely true beats a complete one that is partly invented.

## What to produce

1. **A Python script** using `openpyxl` that writes the workbook, and the workbook itself by
   running it. Write a script rather than hand-editing cells, because the label columns need
   **real merged ranges** and those are easy to get wrong by hand. Name the output after the
   source file.
2. **`CONVERSION-REPORT.md`** beside it, containing:
   - **Rows I could not complete** — every cell you left blank or marked `Note` because the
     source did not say, each with the sentence from the source and what a human needs to
     decide. This is the most important section; put it first.
   - **Judgment calls** — anywhere you chose between readings, and why.
   - **What I dropped** — anything in the source that has no place in the format, and why.
   - **Counts** — pages, rows written, rows checkable (`Check? = Yes`), rows noted.

## Procedure

1. **Read the source end to end before writing anything.** Build a list of pages first.
2. **`Pages List`** — one row per page. For `Identifying text`, choose text that genuinely
   appears on that page and will not change between runs: a heading, not a date, not a page
   number. If the source does not make a page's necessity clear, use `Conditional` and say so
   in your report — it is the forgiving value.
3. **`Settings`** — copy the page size and any tolerances the source states. If it states
   none, keep the defaults shown in the structure file. Leave `Pixels per inch` blank unless
   the source gives a density.
4. **`Lists`** — keep the parameter catalogue exactly as the structure file gives it. Replace
   the colour palette (`Colour name` / `Hex`) and the font list with the ones the source
   actually uses. If the source names a colour with no hex, put the name in `Colour name` and
   leave `Hex` blank, and report it.
5. **One sheet per page**, named by its `Tab` value. Walk the source top to bottom and turn
   each *measurable fact* into one row. One sentence is usually several rows: "the title sits
   5.75 in from the top in 28pt Helvetica Bold, Kestrel Navy" is five rows — `Top`, `Font`,
   `Font size`, `Bold`, `Colour`.
6. **Split every value from its unit.** `Value` = `14`, `Unit` = `pt`. A unit inside `Value`
   is the single most common failure.
7. **Fill `From`** for every `Top`, `Left`, `Right`, `Bottom`, `Baseline` and `Wrap at`, using
   one of the eight phrases in `Lists!K`. If the source does not say whether a distance is
   from the page or from its container, that is a question for a human — leave it blank and
   report it.
8. **Merge the label columns.** `Element`, `Part` and `Group` are merged ranges spanning the
   rows they cover, not values repeated on every row, and not blanks.
9. **Check your own work** against the self-check list at the end of the structure file before
   you hand anything over.

## Output conventions

- Sheet order: `Pages List`, `Settings`, `Lists`, then the page sheets in page order.
- `Check?` is `Yes`, `Note` or `No` in every row — never blank.
- Leave `Tolerance` blank unless the source states a tolerance for that specific row; blank
  means "use the `Settings` default", which is what you want.
- Put the source's own wording in `Notes` wherever you interpreted it. A future reader needs
  to see what you were working from.
- Do not invent a `Description`. Leave it blank if the source has nothing to say.

## How this will be verified

The workbook you produce will be run through:

```bash
pdfsuite spec <workbook>.xlsx --validate-only --out ./out
```

Exit `0` means every row reads. Exit `2` means some rows were refused — `out/validation.json`
names each one by sheet, cell and code, and `out/<name>.annotated.xlsx` is the workbook back
with those cells filled red and the message attached to the cell.

**Refusals caused by the source being vague are an acceptable, expected result** — they are
the list of questions for the spec's author. Refusals caused by *you* — a unit left inside
`Value`, a misspelled parameter, a blank label outside a merge, a missing `From` you could
have filled from the source — are not. Before you finish, re-read the refusal table in the
structure file and confirm that every error your workbook would produce is the first kind,
and say so explicitly in your report.

If you can run the command, run it, fix anything of the second kind, and include the final
counts in your report.
