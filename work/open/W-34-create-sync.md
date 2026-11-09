---
type: Handoff
name: W-34
description: "Arpit, 2026-10-18: `npm create @pdfsuite@latest -- --sync` upgrades an app created earlier — @pdfsuite versions bumped together, untouched shell files replaced, edited ones never overwritten."
item: W-34
filed: 2026-10-18
filed_by: Arpit
updated: 2026-11-09
updated_by: Siddharth
ball: agent
---

# W-34 — `--sync`: upgrade an app without overwriting what a team changed

## At a glance

| | |
|---|---|
| **What** | `npm create @pdfsuite@latest -- --sync` reads `.pdfsuite/installed.json`, bumps every `@pdfsuite/*` dependency to one version, replaces shell files whose hash is unchanged, and writes `*.pdfsuite-new` beside edited ones |
| **Why** | Arpit: an app installed once must sync with newer files and functionality on upgrade (L4 decision 5) |
| **Done when** | On a sample app with one edited and one untouched file, sync replaces the untouched one, leaves the edited one, writes its `.pdfsuite-new`, and lists it; `--check` exits 1 when behind |
| **Status** | 🟢 **5 of 5 DoD done 2026-11-09** |
| **Waits on** | nothing — W-31 landed 2026-11-09 |
| **Who** | `agent` · Opus |
| **Record** | SR-NPM-PACKAGES |

```mermaid
flowchart LR
  S1["1 · read record"] --> S2["2 · versions"] --> S3["3 · files"] --> S4["4 · check mode"] --> S5["5 · test · record"]
```

<details>
<summary><b>ASCII twin</b></summary>

```text
  1 read record --> 2 versions --> 3 files --> 4 check mode --> 5 test + record
```

</details>

**Arpit, 2026-10-18:** *"We could have installed it once and later on when we upgrade pdf
suite, we might be trying to sync with the newer files and newer functionalities."*

**Model:** Sonnet: hash comparison and file writes, with every rule fixed in the record.

## How it can be built

- **The record:** `.pdfsuite/installed.json` (W-31) — version, and each file with its SHA-256.
- **Per file:** missing → write; hash matches the record → replace; hash differs → write
  `<file>.pdfsuite-new`, list it, keep the original; deleted by the consumer → stay deleted
  (`--restore` brings it back).
- **`package.json`:** only `@pdfsuite/*` entries change, all to the same exact version.
- **Report:** a summary of replaced, added, kept-with-`.pdfsuite-new`, and skipped files.
- **`--check`:** no writes; exit 1 when the app is behind, for CI.

## Definition of done

| DoD | what | state |
|---|---|---|
| 1 · read record | `installed.json` read and validated; a missing record → exit 2 with "run create first" | ✅ |
| 2 · versions | every `@pdfsuite/*` dependency set to one exact version; nothing else in `package.json` touched | ✅ |
| 3 · files | the four file rules above; the record rewritten with new hashes | ✅ |
| 4 · check mode | `--check` writes nothing, exits 1 when behind | ✅ |
| 5 · test · record | a test on a sample app proves each rule; SR-NPM-PACKAGES decision 8 marked built | ✅ |

## What landed — 2026-11-09

- **`packages/create/src/sync.ts`**, and `--sync`, `--check` and `--restore` on the bin.
  The four rules are one `if` each, and the report names every file that was kept and
  every dependency that moved.
- **`package.json` is never replaced as a file**, in either mode. Only its `@pdfsuite/*`
  entries move, to one exact version; the consumer's own dependencies, scripts and keys
  are untouched, and so are their indentation and trailing newline.
- **`--check` means "we have something newer"**, not "you edited a file". It is for CI,
  and an app whose config somebody customised on day one must not fail every build
  forever.
- **Hashes are of content, with line endings normalised** — W-34's hazard, applied back
  to W-31's manifest. `core.autocrlf` is guaranteed to happen and guaranteed not to mean
  anything; without this every file looks edited and an upgrade delivers nothing while
  littering `.pdfsuite-new` beside each one.

### Three bugs, all found by running it a second time

Each is now checked **twice** in [`check-create.sh`](../../scripts/check-create.sh), which
is 63 checks. A rule that holds on the first upgrade and breaks on the second is the kind
nobody finds by reading.

1. **A consumer's edit was laundered into the record.** The new manifest was built by
   hashing the files off disk — correct after `create`, which has just written them all,
   and wrong after `sync`, which deliberately does not. An edited file's own hash went in
   as "what pdfsuite wrote there", so the *next* upgrade saw a match and overwrote it
   without a word. The record is now built from what pdfsuite **intends** at each path.
2. **"Stays deleted" lasted one upgrade.** A deleted file was dropped from the record, so
   the next sync found no record of it, called it new, and wrote it back. Its entry is
   carried forward now.
3. **`package.json` was a recorded file in new mode**, so an upgrade would have replaced
   it wholesale and deleted every dependency and script the consumer had added — the
   exact loss L4 decision 5 exists to prevent, arriving through the command written to
   prevent it.

### One promise W-31 made that was not true

`create` printed *"Upgrades leave it alone"* about `pdfsuite.config.ts`, and the file's
own header said upgrades never overwrite it. Neither was the rule. The rule is
hash-based: an **edited** file is never overwritten, and an untouched one is replaced like
any other — which is harmless, because untouched means it still says what we wrote. Both
sentences now say that.

## Blockers

- None. W-31 landed 2026-11-09.

## Record affected

[SR-NPM-PACKAGES](../../records/0107_NPM-packages.md) decision 8; [SR-LAW-4](../../records/0006_LAW-4-how-packages-work.md) decision 5 becomes enforced.

## Hazards

- **Never overwrite an edited file** — the veto condition of L4.
- Line-ending changes alter a hash — normalise to `\n` before hashing, and say so.

## Reference

- [SR-NPM-PACKAGES](../../records/0107_NPM-packages.md) · [W-31](W-31-create-pdfsuite-app.md)
