---
type: Index
description: "Index of parked, undecided ideas, each with a graduation trigger."
---

# `work/proposals/` — parked ideas

Ideas worth keeping that are **not being built now** and **not yet decided**.
Every proposal names its **graduation trigger**. Every file here also carries
one `B-nnn` row in [`../BACKLOG.md`](../BACKLOG.md), filed and deleted in the
same change as the proposal.

Frontmatter:

```yaml
---
type: Proposal
title: <idea>
description: <one line>
status: proposed        # proposed | graduated | rejected
timestamp: <ISO 8601>
---
```

| doc | idea | graduation trigger | status |
|-----|------|--------------------|--------|
| [excel-spec-comparison.md](excel-spec-comparison.md) | the Excel workbook is the PDF spec; upload PDF + `.xlsx`, see every mismatch by cell — graduated into [SR-SPEC-INTAKE](../../records/0101_SPEC-intake.md), [SR-SPEC-CHECK](../../records/0102_SPEC-check.md), [SR-CONSTANTS](../../records/0103_CONSTANTS.md), [SR-STACK-TYPESCRIPT](../../records/0104_STACK-typescript.md) | Arpit's rulings, 2026-10-16 | graduated |
| [pdfsuite-compare-cli.md](pdfsuite-compare-cli.md) | `pdfsuite compare` redesigned from a blank slate — commands, pairing, verdict, exit codes, output files; tracked by [W-07](../open/W-07-pdfsuite-compare-redesign.md) | Siddharth's or Arpit's ruling on W-07 | proposed |
