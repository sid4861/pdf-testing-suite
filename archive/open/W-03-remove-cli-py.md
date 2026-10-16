---
type: Handoff
name: W-03
description: "Arpit, 2026-10-16: remove the Python CLI (cli-py/) and every live reference to it; the Node CLI is the only CLI."
item: W-03
filed: 2026-10-16
ball: agent
closed: 2026-10-16
---

# W-03 — remove the Python CLI

**Arpit, 2026-10-16:** *"We will remove that thin Python wrapper."* … *"Let's file a work
item for it."*

**Model:** Sonnet: a mechanical removal with a grep to confirm nothing still points at it.

## Goal

`cli-py/` is gone and nothing live still describes it. The Node CLI (`cli/`) is the only
CLI (SR-STACK-TYPESCRIPT decision 2).

## Definition of done

| DoD | what | state |
|---|---|---|
| 1 · delete | `cli-py/` removed from the repo | ✅ |
| 2 · docs | `docs/ARCHITECTURE.md`: the *Python wrapper* section and its link in the contents removed, the Python node dropped from diagram 01; `docs/architecture/17-cli-python-wrapper.svg` removed and `01-*.svg` re-rendered | ✅ |
| 3 · references | no live mention left in `cli/README.md`, `cli/docs.html`, `cli/plan.md`, `README.md`, `presentation-script.md`, `public/presentation.html` (history in `work/WORKLOG.md` and `archive/` stays) | ✅ |
| 4 · tables | the `cli-py/` row removed from the Ownership table in `records/README.md`; registry rows for `cli-py` files removed | ✅ |
| 5 · check | `git ls-files 'cli-py/**'` returns nothing and `grep -rIl 'cli-py' --exclude-dir=archive --exclude=WORKLOG.md .` lists only records and this file | ✅ |
| 6 · record | SR-STACK-TYPESCRIPT `built` set to yes in the register; its Consequences updated | ✅ |

## Blockers

None. **Closed 2026-10-16** — done in the same session once the device shell was back.

## Record affected

[SR-STACK-TYPESCRIPT](../../records/0104_STACK-typescript.md) decision 2.

## Hazards

- **`cli-py` is not thin.** Its `generate` is a full Python port. Nothing is lost: the Node
  `pdfsuite generate` has every flag. Do not port anything back.
- `tools/samples/*/generate.py` and `cli/verify/make-cases.py` are **not** part of this
  item — they wait on the inbox ruling (SR-STACK-TYPESCRIPT decision 4).

## Reference

- [SR-STACK-TYPESCRIPT](../../records/0104_STACK-typescript.md)
- [`docs/ARCHITECTURE.md`](../../docs/ARCHITECTURE.md) §Python wrapper
- [`cli/README.md`](../../cli/README.md)
