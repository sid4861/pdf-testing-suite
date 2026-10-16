---
type: Register
description: "The SR register: the convention, the ownership table, and the state of every record."
---

# SRs — the decision records

**How to use this file.** The naming convention, the record shape, the
ownership table and the rules every record obeys. Read it before writing a
record, before citing one, and before adding a module under every tracked path in the repository (`src/`, `cli/`, `public/`, `tools/` and the root files).

One record per completed feature or ruled measurement. **Every record is cited
by NAME in prose, never by number.**

## What an SR is — and what it is not

A Standing Record is a **maintained specification**, not a decision-log entry:
amended in the same change as the code (law zero); superseded records are
rewritten or deleted; retired records are archived (L1); cited by name because
the content moves; it **owns** components and carries a veto condition to check
*today*. The decision-log role lives in `work/compare/` (the fork, its verdict,
its reopen-trigger) and `work/WORKLOG.md`.

## One directory, one state

`records/` is the only home a LIVE record has. A superseded record is rewritten
or deleted in the change that supersedes it; a **retired** record is moved to
`archive/records/` with `status: archived`, a dated banner and an
`archive/README.md` row (L1), and from then on is named, never cited.

Three files here are NOT records and carry no number: this register,
`TEMPLATE.md`, and `RULE-SINCE`.

## The three kinds

Every record declares a `kind`; it answers *what would have to change for this
record to become wrong?*

| `kind` | becomes wrong when | the gate the kind selects |
|---|---|---|
| `law` | Siddharth or Arpit rules differently | precedence: a record conflicting with a law is void in the conflicting part |
| `component` | the code changes | `scripts/sr-guard.sh` — the owning record is touched in the same change |
| `process` | the way work is done changes | it owns its enforcement — a hook or script today, a test once tests exist |

## The convention

**Path.** `records/NNNN_<short-name>.md`, on three ranges:

| range | holds | a new record takes |
|---|---|---|
| `0001`–`0050` | the **Law** records only — `0001` SR-LAWS, `0002` SR-LAW-0, `0003` SR-LAW-1 | the next free number after the highest law |
| `0051`–`0100` | the **WORK** records only — how work is done | the next free number after the highest |
| `0101`– | every other record | the next free number after the highest |

Gaps are reservations; no placeholder files. The number is a filename ordinal,
**not an identity**. **Cite by NAME, never by number.**

### Frontmatter is the metadata, and the body never restates it

Keys, in this order: `type` · `kind` · `name` · `title` · `description` ·
`status` · `date` · `feature` · `owns` · `laws` · `timestamp` · `content_sha`;
optional `supersedes`, `ratifies`. See `TEMPLATE.md` for each value. **Quote
any value containing `: `.** The body opens at §1 and restates none of it.

### A record states what is true now. It carries no history.

No `Amended` sections. When a decision changes, rewrite the sentence in place,
in the same commit. The one exception is an argument that still binds — it
belongs in *Alternatives considered*.

### Two sections and a bibliography

**§1 — For humans**: one screen; a diagram (Mermaid and a collapsed ASCII
twin, updated together). **§2 — For agents**: Context · Decision (numbered) ·
Consequences · Alternatives considered · Reference (required) · Veto
condition. **References**: every source cited, grouped; nothing new; never an
archived document.

**The reference is grounded** — never an archived doc. **The veto condition is
a condition, not an event** — checkable today with a command.

**A record that restates a cross-cutting principle is a bug.** Each law lives
in its own `SR-LAW-n` record; every other record names it in `laws:` and moves
on.

### Records are kept current by a check, not by good intentions

| where | what it does |
|---|---|
| `scripts/sr-guard.sh` | a `commit-msg` hook: refuses a commit that changes an owned component without staging its owning record and every describer — unless the message carries `no SR affected` on its own line. Install: `ln -sf ../../scripts/sr-guard.sh .git/hooks/commit-msg` |
| `records/RULE-SINCE` | the baseline commit sha from which the rule applies, for a CI replay once one exists |

**The escape hatch is a claim in git history under your name**, not a silent
skip. What none of this proves: that a touched record is **coherent**.

Start from `TEMPLATE.md`.

---

## The register

| # | name | title | status | built |
|---|------|-------|--------|-------|
| [0001](0001_LAWS.md) | **SR-LAWS** | The laws have exactly one home each; this record routes the handles | accepted | yes |
| [0002](0002_LAW-0-authority.md) | **SR-LAW-0** | **L0** — records are the only source of truth; Law records outrank every other record | accepted | yes |
| [0003](0003_LAW-1-retired-records-archived.md) | **SR-LAW-1** | **L1** — a retired record is archived, never deleted | accepted | yes |
| [0051](0051_WORK-open-queue.md) | **SR-WORK-OPEN-QUEUE** | How `OPEN-WORK.md` works — the queue discipline in eight groups | accepted | yes |
| [0052](0052_WORK-backlog.md) | **SR-WORK-BACKLOG** | How `BACKLOG.md` works — the named-but-unclaimed in five classes | accepted | yes |
| [0053](0053_WORK-lifecycle.md) | **SR-WORK-LIFECYCLE** | How a feature travels — compare, proposal, handoff in the item file, the model line, one record | accepted | yes |
| [0054](0054_WORK-session.md) | **SR-WORK-SESSION** | What a session owes before it ends; the two-strikes rule | accepted | yes |
| [0055](0055_WORK-docs.md) | **SR-WORK-DOCS** | The documentation contract — form, steering-file edits, the documents every task updates | accepted | yes |
| [0056](0056_WORK-blockers.md) | **SR-WORK-BLOCKERS** | A blocker is a file, not a remark — `work/BLOCKED.json` and the three hooks | accepted | yes |
| [0057](0057_WORK-archive.md) | **SR-WORK-ARCHIVE** | One archive; named, never cited | accepted | yes |
| [0058](0058_WORK-ownership.md) | **SR-WORK-OWNERSHIP** | `owns` and `describes`, and the commit guard | accepted | yes |
| [0059](0059_WORK-governance.md) | **SR-WORK-GOVERNANCE** | The governance map — which file governs what; no counts | accepted | yes |
| [0060](0060_WORK-registry.md) | **SR-WORK-REGISTRY** | The doc registry — rules in §2, the table in §3 | accepted | yes |
| [0101](0101_SPEC-intake.md) | **SR-SPEC-INTAKE** | The spec workbook, its validation, and its conversion to spec JSON | accepted | no |
| [0102](0102_SPEC-check.md) | **SR-SPEC-CHECK** | Checking a PDF against spec JSON — pages, reading, comparing, coverage | accepted | no |
| [0103](0103_CONSTANTS.md) | **SR-CONSTANTS** | One constants file for every default and limit | accepted | no |
| [0104](0104_STACK-typescript.md) | **SR-STACK-TYPESCRIPT** | The product is TypeScript; the Python CLI is removed | accepted | yes |

---

## Ownership — which record owns which component

**This table is the answer, not a judgement call.** Every component under
every tracked path in the repository appears here exactly once. Most specific wins; a carve-out is
justified by a *different decision*. A component with no decision yet is owned
by an open `W-nn`. A record's `owns:` key and this table agree in both
directions.

<!-- OWNERSHIP-TABLE-START -->

| component | owner | note |
|---|---|---|
| `scripts/sr-guard.sh` | SR-WORK-OWNERSHIP | the guard is the executable form of decisions 3 and 6 |
| `scripts/check-open-work-inbox.py` | SR-WORK-OPEN-QUEUE | rule 45a's check |
| `.claude/hooks/guard-open-work-inbox.sh` | SR-WORK-OPEN-QUEUE | rule 45a, in-session |
| `.claude/hooks/inject-inbox.sh` | SR-WORK-BLOCKERS | decision 7 |
| `.claude/hooks/stop-if-blocked.sh` | SR-WORK-BLOCKERS | decision 7 |
| `.claude/hooks/session-lock.sh` | SR-WORK-BLOCKERS | decision 7 |
| `.claude/hooks/require-progress.sh` | SR-WORK-SESSION | decision 5 |
| `src/` | W-01 | the React/Vite PDF compare app — no record yet |
| `src/features/spec/specCheck.ts` | SR-SPEC-CHECK | the spec checker |
| `src/features/spec/specExport.ts` | SR-SPEC-CHECK | the spec report exports |
| `src/features/spec/specStore.ts` | SR-SPEC-CHECK | the spec tab's state |
| `src/features/spec/SpecTestView.tsx` | SR-SPEC-CHECK | the spec tab |
| `src/features/spec/SpecExportMenu.tsx` | SR-SPEC-CHECK | the spec tab's export menu |
| `src/features/spec/types.ts` | SR-SPEC-INTAKE | the spec JSON type |
| `src/services/specConstants.ts` | SR-CONSTANTS | every default and limit — created by W-05 |
| `cli/` | W-01 | the Node CLI — no record yet |
| `public/` | W-01 | static pages and samples — no record yet |
| `public/samples/spec-sample.json` | SR-SPEC-CHECK | the in-app spec sample |
| `public/samples/spec-sample.pdf` | SR-SPEC-CHECK | the in-app spec sample |
| `tools/` | W-01 | planning notes — no record yet |
| `tools/samples/excel-spec-hierarchical/` | SR-SPEC-INTAKE | the fictional legacy-layout spec fixture |
| `index.html` | W-01 | app entry — no record yet |
| `vite.config.ts` | W-01 | build config — no record yet |
| `tsconfig.json` | W-01 | build config — no record yet |
| `tsconfig.tsbuildinfo` | W-01 | build artefact — no record yet |
| `package.json` | W-01 | dependencies — no record yet |
| `package-lock.json` | W-01 | dependencies — no record yet |
| `flag.env` | W-01 | feature flags — no record yet |
| `README.md` | W-01 | product docs — no record yet |
| `spec-standard.md` | SR-SPEC-INTAKE | the spec JSON format and the workbook template |
| `comparison.md` | W-01 | product docs — no record yet |
| `presentation-script.md` | W-01 | product docs — no record yet |
| `docs/ARCHITECTURE.md` | W-01 | product architecture diagrams — no record yet |
| `docs/architecture/` | W-01 | standalone SVGs rendered from `docs/ARCHITECTURE.md` — no record yet |
| `.tmp-old-block.txt` | W-01 | stray file — no record yet |
| `.gitignore` | W-01 | repo config — no record yet |
| `.claude/launch.json` | W-01 | dev launch config — no record yet |

<!-- OWNERSHIP-TABLE-END -->

## Describes — which record's subject REACHES INTO a component it does not own

Ownership stays one record per component; **describes is any number**, and the
guard demands the owner **and every describer**. Every row states its reason.
A component may be narrowed to symbols: `` `path::name,name` ``.

<!-- DESCRIBES-TABLE-START -->

| component | describer | why |
|---|---|---|
| `src/features/spec/specStore.ts` | SR-SPEC-INTAKE | holds the uploaded spec and its validation (decisions 1, 2, 13) |
| `src/features/spec/SpecTestView.tsx` | SR-SPEC-INTAKE | the spec upload — accepted types, label, downloads (decisions 1, 14) |
| `src/features/spec/specCheck.ts::validateSpec` | SR-SPEC-INTAKE | validates an uploaded spec JSON (decision 2) |

<!-- DESCRIBES-TABLE-END -->
