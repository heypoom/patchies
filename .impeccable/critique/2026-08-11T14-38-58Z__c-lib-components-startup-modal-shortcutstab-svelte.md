---
target: Shortcuts tab
total_score: 24
max_score: 36
na_heuristics: 9
p0_count: 0
p1_count: 2
timestamp: 2026-08-11T14-38-58Z
slug: c-lib-components-startup-modal-shortcutstab-svelte
---
# Shortcuts tab critique

## Design Health Score

| # | Heuristic | Score | Key issue |
|---|-----------|------:|-----------|
| 1 | Visibility of system status | 3 | Active tab and section counts are visible, but the long reference has no progress or scroll cue. |
| 2 | Match between system and real world | 3 | Most actions are concrete; slash-delimited phrases read like implementation shorthand. |
| 3 | User control and freedom | 2 | The modal closes predictably, but focus management is not evident from this surface. |
| 4 | Consistency and standards | 3 | Keycaps and rows are consistent until long content breaks the rhythm. |
| 5 | Error prevention | 2 | The reference reduces shortcut mistakes, but cramped gesture/action pairs are easy to misread. |
| 6 | Recognition rather than recall | 2 | Commands are visible but seventeen equal-weight keyboard commands require serial scanning. |
| 7 | Flexibility and efficiency | 4 | Coverage is broad and Cmd/Ctrl labels adapt to platform. |
| 8 | Aesthetic and minimalist design | 2 | The large intro consumes reference space and the two-column grid compresses the content it should clarify. |
| 9 | Error recovery | n/a | Read-only reference surface with no local error state. |
| 10 | Help and documentation | 3 | Reachable and concise, but task organization and semantic navigation are weak. |
| **Total** | | **24/36** | **Acceptable — significant improvement needed** |

## Design Specificity Verdict

The Ink/Zinc/Ember palette, Plex Sans/Mono pairing, keycap styling, and “Move at patch speed” language belong to Patchies. The two-column shortcut sheet itself is category-interchangeable. It organizes by input device instead of the tasks Patchies users are trying to complete: navigate, select, create, save, run, and perform.

The deterministic detector returned zero findings. Live browser measurements show that this is a false negative: at the default desktop width, the combined selection row gives its description roughly 76px while preserving a 197px non-wrapping key group. “Select multiple objects and edges” becomes four lines and expands the row from roughly 52px to 88px. No horizontal clipping occurs; the defect is content-priority and wrapping pressure.

No user-visible overlay was produced because the available browser evaluation surface is read-only and cannot pass the required injection preflight. Desktop and compact screenshots plus DOM measurements were used instead.

## Overall Impression

The page promises fluency but presents an inventory. Its strongest assets are the product tone, platform-aware keys, and complete coverage. Its biggest opportunity is to turn the list into a task-oriented control reference that scans as quickly as the shortcuts it documents.

## What’s Working

- The headline, Ember accents, and technical keycaps fit the modal’s established visual system.
- Gesture/action pairs are direct, and individual keys use appropriate `kbd` semantics.
- The one-column compact layout contains the content without horizontal page overflow.

## Priority Issues

1. **[P1] The desktop grid squeezes its hardest content.** Two half-width cells cannot hold long actions and rigid key clusters. Use a wider Shortcuts modal, content-driven breakpoints, explicit action/input columns, and shorter natural phrases.
2. **[P1] The accessibility hierarchy is visual rather than semantic.** Group labels and rows are generic containers. Use sections, headings, and lists; increase low-contrast metadata.
3. **[P2] Mouse versus keyboard is the wrong primary taxonomy.** Users search by task. Group into Canvas & selection, Create & edit, Patch & workspace, and Run & playback.
4. **[P2] The hero is oversized for a lookup surface.** Compress the intro so useful reference content enters the first viewport.
5. **[P3] Slash syntax and verbose copy add friction.** Replace “Click on object / edge” and “Select multiple objects and edges” with compact natural language such as “Click object or edge” and “Add to selection.”

## Persona Red Flags

- **Alex, power user:** broad coverage helps, but seventeen equal-weight commands and uneven row heights slow lookup.
- **Jordan, first-timer:** object, edge, transport, and preview vocabulary is not scaffolded by task-oriented grouping.
- **Sam, accessibility-dependent user:** generic containers prevent heading/list navigation, while tiny muted counts and metadata reduce legibility.

## Minor Observations

- The seventh mouse gesture leaves an empty desktop grid cell.
- Hover styling suggests interactivity on a read-only list.
- The reactive shortcut counts are useful but too faint.

## Questions to Consider

- Is “Move at patch speed” better served by an inventory or a control map organized around real Patchies tasks?
- Should reference density earn a dedicated wider modal state?
- Which four shortcuts should a first-time user learn before the full inventory?
