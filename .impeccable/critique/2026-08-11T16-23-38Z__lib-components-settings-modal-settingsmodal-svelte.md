---
target: settings modal
total_score: 21
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 3
slug: lib-components-settings-modal-settingsmodal-svelte
timestamp: 2026-08-11T16-23-38Z
---
## Design Health Score

| # | Heuristic | Score | Key issue |
|---|---|---:|---|
| 1 | Visibility of System Status | 2 | Active category is visible, but persistence and delayed apply behavior are not explained. |
| 2 | Match System / Real World | 3 | Per-user and per-patch framing is strong; several technical labels assume prior knowledge. |
| 3 | User Control and Freedom | 2 | Close works, but initial focus, focus containment, and focus restoration are incomplete. |
| 4 | Consistency and Standards | 2 | The shell is restrained, but tiny targets, a raw close glyph, and weight 600 diverge from the current modal system. |
| 5 | Error Prevention | 2 | Bounds exist, but invalid values can fail silently and recovery is not surfaced. |
| 6 | Recognition Rather Than Recall | 3 | Desktop categories are clear; mobile hides later categories in a horizontal strip. |
| 7 | Flexibility and Efficiency | 2 | Cmd+, is efficient, but mobile category access and keyboard-modal behavior add friction. |
| 8 | Aesthetic and Minimalist Design | 3 | Calm and readable, but dense categories are undifferentiated and sparse categories leave a dead canvas. |
| 9 | Error Recognition and Recovery | 1 | Invalid room, output-size, model, and numeric values lack inline recovery. |
| 10 | Help and Documentation | 1 | Descriptions exist, but consequences, defaults, and provider guidance are limited. |
| **Total** |  | **21/40** | **Acceptable; significant accessibility and mobile-navigation work needed.** |

## Design Specificity Verdict

**LLM assessment:** Partially authored for Patchies. The per-user/per-patch taxonomy, quiet zinc surface, and restrained orange selection suit a creative instrument. The remaining composition is a conventional settings sidebar with generic rows and little connection to the patch canvas.

**Deterministic scan:** The detector returned `[]` with zero findings. This was a false negative relative to live evidence: it did not model focus ownership, accessible control names, touch-target sizes, or responsive horizontal-navigation pressure.

**Visual evidence:** Mutable overlay injection was unavailable. Assessment used a fresh in-app browser tab, DOM measurements, accessibility snapshots, and desktop/mobile screenshots instead.

## Overall Impression

The modal has the right information architecture and the wrong interaction finish. Desktop scope grouping is the strongest product decision. Mobile flattens that clarity into an overflowing tab strip, while keyboard and screen-reader users cannot reliably identify or remain within the dialog. The best redesign preserves the restrained shell and scope model while making category selection, focus, control names, and persistence explicit.

## What's Working

- **Scope is product-specific:** separating workspace preferences from current-patch state directly resolves a real Patchies ambiguity.
- **The visual tone is appropriate:** opaque ink surfaces, fine dividers, and scarce orange keep attention on the editor.
- **The responsive shell is structurally sound:** it fills mobile safely and contains content scrolling without page overflow.

## Priority Issues

### [P1] Focus is not owned by the dialog

After shortcut-open, focus remained outside the modal. Background controls stayed focusable, and dismissal did not restore focus to the trigger.

**Fix:** focus the dialog on open, trap Tab within visible controls, handle Escape at the window level, and restore the previous control after close.

### [P1] Controls are not named by their settings

Every switch announced as `Toggle`, while dropdowns lacked accessible names. Visible row titles were not programmatically connected to controls.

**Fix:** give every switch, dropdown, and text/number control a unique accessible name matching its setting.

### [P1] Mobile category navigation hides destinations

At 390px, the category rail was 575px wide inside a 388px viewport. At 320px, the native scrollbar crossed the tab labels and could intercept clicks. Transport and Network were initially invisible.

**Fix:** replace the horizontal rail with a 44px grouped category picker that preserves workspace/current-patch scope.

### [P2] Hierarchy is too uniform

Editor presents eight equal rows without strong chunking, while General leaves most of the fixed dialog empty. The header also used weight 600 and a raw text close glyph.

**Fix:** use one bounded setting surface, a clearer category summary, weight 500, Lucide icons, and neutral active navigation with a small orange indicator.

### [P2] Persistence and validation are implicit

Most changes apply immediately, but the modal did not say so. Invalid numeric and text values may fail without a visible explanation.

**Fix:** state the auto-save contract once. Follow up with inline validation and reset affordances where parsing can fail.

## Persona Red Flags

- **Keyboard/screen-reader user:** focus began outside the dialog; switches had identical names; selects were unnamed.
- **Distracted mobile user:** later categories and their scope were hidden in an unlabeled horizontal scroller with undersized targets.
- **First-time patcher:** terms such as cook stats, Zen editor, netsend/netrecv, and model identifiers need consequences or examples, not only labels.

## Assessment Evidence

- Desktop dialog: 780×612 at 1280×720; sidebar targets were about 28.5px high and close was about 18.6×23px.
- Mobile: dialog filled 390×844 without page overflow, but category content was 575px wide in a 388px viewport.
- Narrow mobile: category scrollbar overlaid labels; a center click on Network failed while an upper click succeeded.
- Detector: one run, exit 0, raw JSON `[]`; no false positives.
- Browser console: no warnings or errors.

## Implemented Polish

- Unified restrained shell with a 900px desktop dialog, 44px mobile close target, Lucide icons, and no backdrop blur.
- Desktop scope sidebar retained and strengthened with icons, a neutral selected surface, and one orange position indicator.
- Mobile tab rail replaced by a grouped native category picker.
- Added category summaries and explicit `Your workspace` / `Current patch` scope badges.
- Added focus ownership, Tab containment, window Escape handling, and focus restoration.
- Added distinct accessible names for toggles, selects, and inputs.
- Added an explicit `Changes save automatically` cue and removed weight 600 from the modal shell.
- Settings rows now sit in one quiet bounded surface and stack controls on very narrow viewports.

## Run Notes

- Assessment A and B ran independently before synthesis.
- Ignore list was absent.
- Overlay injection and its live server were skipped because browser mutation was unavailable.
- Fresh assessment tabs were finalized and closed; no temporary assessment files or servers remained.
