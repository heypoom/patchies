---
target: docs page
total_score: 27
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 3
timestamp: 2026-08-11T17-24-39Z
slug: ui-src-routes-docs
---
## Design Health Score

| # | Heuristic | Score | Key issue |
|---|---|---:|---|
| 1 | Visibility of system status | 3 | Active page is clear; search status can be stronger. |
| 2 | Match system / real world | 3 | Familiar reading and search patterns. |
| 3 | User control and freedom | 3 | Back link, sidebar toggle, and dismissible search are available. |
| 4 | Consistency and standards | 2 | Heavy headings and ambient glow conflicted with the quiet Plex system. |
| 5 | Error prevention | 3 | Browsing is low-risk and invalid paths are constrained. |
| 6 | Recognition rather than recall | 3 | Persistent navigation and search help discovery. |
| 7 | Flexibility and efficiency | 3 | Cmd/Ctrl-K is a useful accelerator. |
| 8 | Aesthetic and minimalist design | 2 | Decorative background and heavy typography competed with reading. |
| 9 | Error recovery | 2 | Empty search has no recovery guidance. |
| 10 | Help and documentation | 3 | Searchable reference is useful, but first-time wayfinding can improve. |
| **Total** | | **27/40** | **Acceptable — significant refinement needed** |

## Design Specificity Verdict

The docs had product-specific foundations—dark zinc structure, mono object names, Ember navigation,
and real patch imagery—but the orange glow and emphatic headings belonged to a louder visual world.
The detector found no automated issues in `ui/src/routes/docs` or `ui/src/lib/components/docs`.

## Overall Impression

The reading surface should let documentation content provide the personality. The most important
change is to make the shell quiet enough that diagrams, screenshots, and code have room to speak.

## What's Working

- The left rail gives stable orientation with clear active-page state.
- Documentation images carry genuine Patchies character.
- Visible search plus Cmd/Ctrl-K supports both scanning and direct retrieval.

## Priority Issues

- **[P1] Ambient decoration:** Remove the warm radial background; it adds no information and competes with content.
- **[P1] Typography weight:** Use restrained Plex weights for titles and headings instead of visually over-announcing the page.
- **[P1] Command-palette padding:** The desktop dialog padding persisted because `sm:p-6` outranked the unscoped `p-0`; explicitly reset it at `sm`.
- **[P2] Dense navigation:** Both long sections start expanded, making the rail demanding for new readers.
- **[P2] Search recovery:** Empty results offer no useful next step.

## Persona Red Flags

- **Power user:** A long unfiltered object list makes retrieval slower than it needs to be.
- **First-time creative coder:** Category names do not provide an obvious learning path.
- **Keyboard and low-vision user:** Small muted navigation text and title-based icon controls warrant a future accessibility pass.

## Minor Observations

- Keep Ember as the single expressive navigation signal after the background is quiet.
- Let actual patch visuals—not decorative chrome—supply each page’s personality.

## Questions to Consider

- Should the sidebar offer a compact “Start here” path before the full catalogue?
- Should empty search point readers back to guides or popular object categories?
