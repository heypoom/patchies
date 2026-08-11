---
target: object browser modal
total_score: 24
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 4
timestamp: 2026-08-11T15-19-49Z
slug: omponents-object-browser-objectbrowsermodal-svelte
---
## Design Health Score

| # | Heuristic | Score | Key issue |
|---|---|---:|---|
| 1 | Visibility of System Status | 3 | Modes and counts are visible, but insertion focus and selection feedback are weak. |
| 2 | Match System / Real World | 3 | Object language is strong; packs, presets, and help are presented as equivalent controls despite different jobs. |
| 3 | User Control and Freedom | 3 | Escape, backdrop close, clear search, and reversible pack toggles are present. |
| 4 | Consistency and Standards | 2 | Mode switches and visibility toggles share the same treatment; nested controls weaken predictability. |
| 5 | Error Prevention | 2 | Dependencies are handled, but pack-card enablement and expansion are easy to confuse. |
| 6 | Recognition Rather Than Recall | 2 | Descriptions help, but presets are buried and the all-enabled catalog becomes a scanning task. |
| 7 | Flexibility and Efficiency | 2 | Search exists, but there is no autofocus, active result, arrow navigation, or Enter-to-insert loop. |
| 8 | Aesthetic and Minimalist Design | 2 | The default is restrained; the all-enabled state becomes an orange, undifferentiated wall. |
| 9 | Error Recovery | 2 | Disabled-object recovery is excellent, but other empty states offer limited guidance. |
| 10 | Help and Documentation | 3 | Dedicated help mode and per-object help are unusually strong. |
| **Total** |  | **24/40** | **Acceptable; significant workflow improvements needed.** |

## Design Specificity Verdict

**LLM assessment:** Moderately product-specific. Object names, descriptions, pack icons, preset taxonomy, disabled-object recovery, and inline help feel authored for Patchies. The object selector cards are strong. The surrounding shell is more generic: it combines launcher, marketplace/settings, and documentation behavior instead of committing to a TouchDesigner-like insertion rhythm.

**Deterministic scan:** The CLI detector returned `[]` with zero findings. This is a false-negative result relative to the live evidence: it did not model scroll depth, touch-target size, accessibility naming, nested button roles, responsive pack-expansion logic, or repeated accent saturation.

**Visual evidence:** No user-visible overlay was produced because the browser surface supported read-only inspection but not mutable script injection. Browser measurements and accessibility-tree inspection were used instead.

## Overall Impression

The modal is good at explaining individual objects and poor at getting out of the way. Its core content is solid, but all categories expand on open and presets are appended after objects, so adding capability makes insertion progressively worse. The single biggest opportunity is to separate rapid insertion from library administration while making Objects and Presets equally discoverable.

## What's Working

- **Object cards are effective:** compact names, useful descriptions, and category grouping support recognition without excessive decoration.
- **Disabled-object recovery preserves intent:** a search can lead directly to “Enable & Add” instead of ending in a dead end.
- **The shell handles modal basics well:** safe-area padding, full-height mobile presentation, Escape/backdrop close, and a bounded scroll region are appropriate for the editor.

## Priority Issues

### [P1] Insertion is not actually instant

**Why it matters:** Opening with Cmd+O leaves focus on `BODY`; the user must click search, and there is no active result, arrow navigation, or Enter-to-insert path.

**Fix:** Autofocus search, flatten active search into ranked results, add visible keyboard selection, Arrow keys, Enter, Escape, and a small Recent/Frequent section before typing.

**Suggested command:** `$impeccable polish`

### [P1] Presets are structurally buried

**Why it matters:** With all content enabled, the first preset starts 418px below the desktop fold, 8,620px below the mobile fold, and 9,004px below the narrow-touch fold. In pack management, “Preset Packs” is also below the first fold.

**Fix:** Make Objects and Presets first-class views above the fold, or expose a compact preset shelf before the full object catalog. Keep pack administration secondary.

**Suggested command:** `$impeccable layout`

### [P1] Progressive disclosure fails as the library grows

**Why it matters:** All categories expand on open. The mobile catalog reached 20,916px, and even a `hydra` search produced roughly 66 matches across four groups and 952px of remaining scroll.

**Fix:** Default most categories closed, remember deliberate expansion, show Recents first, and replace category wrappers with a concise ranked list while searching.

**Suggested command:** `$impeccable distill`

### [P1] Touch and accessibility behavior are below the primary-use requirement

**Why it matters:** On touch devices this is the only insertion path, yet header controls are 25px high, search is 37.5px, pack expansion is 20px, and the mobile expanded-row calculation assumes three columns while rendering two. The dialog is unnamed, pack tiles are non-keyboard clickable divs, and tooltip triggers expose duplicate button roles.

**Fix:** Use 44px targets, separate explicit enable switches from details, correct responsive expansion, provide a real dialog heading/search label, restore semantic buttons and visible focus, and place primary mobile actions within easy thumb reach.

**Suggested command:** `$impeccable adapt`

### [P2] Ember no longer communicates priority

**Why it matters:** In the all-enabled packs view, 56 of 57 visible tiles contained orange styling and 225 dialog elements carried an `orange-500` class. Accent becomes wallpaper.

**Fix:** Render enabled availability neutrally. Reserve Ember for focus, active selection, matched text, and the primary insertion action.

**Suggested command:** `$impeccable quieter`

## Persona Red Flags

**Alex, power user:** Cmd+O does not establish focus, so Alex cannot open, type, and press Enter. Auto-expanded category wrappers slow repeated insertion, and there are no recents or favorites.

**Casey, mobile creator:** Full-screen presentation is good, but the keyboard consumes catalog space, critical controls are undersized, presets are thousands of pixels away, and expansion uses the wrong responsive column count.

**Sam, accessibility-dependent:** The dialog label points at the search input instead of a heading, the search has only placeholder text, pack tiles suppress accessibility warnings instead of being semantic controls, and tooltip composition creates duplicate button roles.

## Minor Observations

- The search placeholder describes objects and presets even in Packs and Help modes.
- “No objects found” is inaccurate when presets were searched too.
- Object-pack and preset-pack counters look equivalent but measure different things.
- “All” and “Reset” are too terse for bulk library changes.
- Zinc-700 microcopy is difficult to read over `#111113`, especially on dim mobile displays.
- Full-canvas backdrop blur adds cost without meaningful visual benefit.

## Questions to Consider

- Is pack management part of insertion, or environment setup that deserves a secondary surface?
- Should presets be “more catalog,” or the inspirational front door for people who do not know an object name?
- What should prevent the very next Enter press after Cmd+O from inserting an object?
- On mobile, should this feel like a desktop modal or a purpose-built app launcher?
