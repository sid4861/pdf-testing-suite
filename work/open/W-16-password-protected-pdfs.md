---
type: Handoff
name: W-16
description: "Arpit, 2026-10-18: ask for the password in the app; take it from an environment variable or file in the CLI; never store or print it."
item: W-16
filed: 2026-10-18
filed_by: Arpit
updated: 2026-10-18
updated_by: Arpit
ball: agent
---

# W-16 — Open password-protected PDFs

## At a glance

| | |
|---|---|
| **What** | Ask for the password in the app; take it from an environment variable or file in the CLI; never store or print it |
| **Why** | Today a password-protected PDF is an error in every surface |
| **Done when** | The encrypted fixture opens in Inspect and Compare after a prompt, and in the CLI from `--password-env`; a wrong password says so |
| **Status** | 🟡 waiting · 0 of 6 DoD done |
| **Waits on** | W-13 |
| **Who** | `agent` · Sonnet |
| **Record** | SR-PDF-SUPPORT |

```mermaid
flowchart LR
  S1["1 · loader"] --> S2["2 · app"] --> S3["3 · cli"] --> S4["4 · report"] --> S5["5 · fixture"] --> S6["6 · record"]
```

<details>
<summary><b>ASCII twin</b></summary>

```text
  1 loader --> 2 app --> 3 cli --> 4 report --> 5 fixture --> 6 record
```

</details>

**Arpit, 2026-10-18:** *"File work items for each and everything that doesn't exist today … research and file work items on how they can be built out. Example, fonts not embedded in CLI, it may not draw the text, but I still want a filing to be there that, okay, there is a difference or not."*

**Model:** Sonnet: one loader hook, one dialog and two CLI options.

## How it can be built — research, 2026-10-18

- **pdf.js:** `loadingTask.onPassword = (update, reason)` — `reason` is `NEED_PASSWORD` (1) or `INCORRECT_PASSWORD` (2); a `PasswordException` otherwise.
- **App:** a small dialog per side, retry on a wrong password; held in memory only — never in a persisted store, a ZIP, a report or a log.
- **CLI:** `--password-env NAME` and `--password-file PATH` (per side); never a value on the command line, where `ps` and shell history show it. Missing or wrong → exit 2 with a clear message.
- **Report:** "encrypted, permissions: …" from `pdf.getPermissions()`.

## Definition of done

| DoD | what | state |
|---|---|---|
| 1 · loader | `openPdf` accepts a password callback; the error says which side and why | ⏳ |
| 2 · app | password dialog per side; wrong password retries; nothing persisted | ⏳ |
| 3 · cli | `--password-env` / `--password-file`; exit 2 when missing or wrong | ⏳ |
| 4 · report | encryption and permissions shown; the password appears nowhere | ⏳ |
| 5 · fixture | fictional fixture(s) for this kind added to W-12's corpus; the harness shows the new behaviour | ⏳ |
| 6 · record | SR-PDF-SUPPORT row(s) for this kind rewritten to today's truth; `docs/ARCHITECTURE.md` updated where a flow changed | ⏳ |

## Spec machine — asked, not tracked here

Ask the spec machine to accept the same prompt in the Spec tab. The spec machine cannot push, so its side never closes anything in this queue.

## Blockers

- 🟡 **Waiting on W-13** — the shared PDF opener (`openPdf`) this builds on.

## Record affected

[SR-PDF-SUPPORT](../../records/0105_PDF-support.md) — the row(s) naming W-16 in its *closed by* column.

## Hazards

- **Leaks:** the test greps reports, ZIPs and logs for the fixture's password.
- The touched files are W-01's, so commits stage `work/open/W-01-claim-components.md` too; never edit `src/features/spec/` from this machine.

## Reference

- `src/services/pdfCompare.ts` `loadPdf` · `src/store/compareStore.ts` · `cli/src/index.ts`
- [SR-PDF-SUPPORT](../../records/0105_PDF-support.md) — the row(s) this item closes
