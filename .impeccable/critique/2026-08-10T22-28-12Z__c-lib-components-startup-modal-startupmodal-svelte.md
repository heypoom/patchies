---
target: StartupModal.svelte startup / onboarding modal
total_score: 22
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 3
timestamp: 2026-08-10T22-28-12Z
slug: c-lib-components-startup-modal-startupmodal-svelte
---
## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|---|---:|---|
| 1 | Visibility of System Status | 2/4 | Active tabs help, but loading a demo has no clear consequence or confirmation. |
| 2 | Match System / Real World | 3/4 | Friendly language, but Sparks and technical node chips assume familiarity. |
| 3 | User Control and Freedom | 3/4 | Close and Escape work; loading a demo lacks safety framing. |
| 4 | Consistency and Standards | 1/4 | Serif/Syne and ornamental brackets conflict with the editor’s Plex Sans/Mono, quiet-zinc system. |
| 5 | Error Prevention | 1/4 | No preview or expectation-setting before a demo changes the canvas. |
| 6 | Recognition Rather Than Recall | 3/4 | Quick tips and textual actions reduce recall burden. |
| 7 | Flexibility and Efficiency | 3/4 | Shortcuts and Escape help experts; startup preference is buried. |
| 8 | Aesthetic and Minimalist Design | 2/4 | Onboarding, reference, community, and gratitude compete in one shell. |
| 9 | Error Recovery | 1/4 | No recovery path around demo loading or a failed fetch. |
| 10 | Help and Documentation | 3/4 | Good resources, but they are not sequenced into a first success. |
| **Total** | | **22/40** | **Needs focused redesign** |

## Design Specificity Verdict

**LLM assessment:** Partly authored, not yet coherent. The content is unmistakably Patchies—node names, demos, creative-coding language—but serif italic headlines, Syne body type, orange corner brackets, radial glow, and sci-fi card ornaments read as a provisional creative-tool skin. The opportunity is to make onboarding feel like a first playable patch rather than a decorated resource index.

**Deterministic scan:** Clean: 0 findings in `ui/src/lib/components/startup-modal/StartupModal.svelte`; no false positives. The scan did not identify the design-flow or visual-system problems found in the design review.

**Visual evidence:** The existing local app rendered the dialog named “Patch the world together” after a bounded wait. No overlay was injected or made visible; no server was started for the review.

## Overall Impression

The opening frame has warmth and genuine creative promise, but it immediately turns into orientation work. The biggest opportunity is a single, safe, outcome-led first action.

## What's Working

- The About tab has a concise, warm proposition without generic corporate onboarding language.
- Demos use real work from the Patchies ecosystem, not placeholders; category grouping helps when someone already has intent.
- Quick tips, shortcuts, and the retained startup setting support continued learning and repeat use.

## Priority Issues

1. **[P1] No single activation path.**
   - **Why it matters:** Browse demos, read the guide, and shortcuts are equal choices, forcing a first-timer to pick a learning strategy before making anything.
   - **Fix:** Make one primary action such as “Start with a visual patch,” with a featured, safely described patch. Demote guide and shortcuts to supporting paths.
   - **Suggested command:** `$impeccable onboard`

2. **[P1] Demos is a library, not onboarding.**
   - **Why it matters:** A long grid asks newcomers to compare unfamiliar works, and “open” does not explain what will change or whether the patch runs.
   - **Fix:** Curate three outcome-led starters—see, hear, interact—with previews and permission/replace-current-patch expectations. Put the full catalog behind “All demos.”
   - **Suggested command:** `$impeccable onboard`

3. **[P1] The visual language contradicts editor authority.**
   - **Why it matters:** Provisional serif/Syne, radial glow, and ornaments make the modal feel inherited from a different visual world, while body copy is too low contrast.
   - **Fix:** Use IBM Plex Sans for prose and Plex Mono for metadata/shortcuts; keep zinc panels and one purposeful Ember state. Replace decoration with a small patch topology or live result.
   - **Suggested command:** `$impeccable typeset`

4. **[P2] Equal tab rank mixes activation with reference and attribution.**
   - **Why it matters:** Thanks and shortcuts are valuable, but presenting them as peer first-session choices turns the modal into a miscellany.
   - **Fix:** Keep Start, Demos, and Learn at the first level. Move Thanks to About/footer; show shortcuts after a first patch is loaded.
   - **Suggested command:** `$impeccable distill`

5. **[P2] Mobile navigation overflows.**
   - **Why it matters:** At 390px, the final tab clips to “T” behind Close, damaging discoverability and confidence.
   - **Fix:** Use a More menu, two-level navigation, or a mobile-specific landing view.
   - **Suggested command:** `$impeccable adapt`

## Persona Red Flags

- **Alex, power user:** Escape works and shortcuts are documented, but the modal opens by default and its opt-out is buried at the bottom. Alex needs a compact “Start patching / Don’t show again” route.
- **Jordan, first-timer:** Technical chips (`hydra`, `strudel`, `glsl`, `chuck~`, `asm`) make the product feel prerequisite-heavy. Demos opens a catalog rather than a recommended, explained success.
- **Maya, creative coder preparing a live visual:** No demo card makes a visual/audio outcome or intent visible, and Sparks is not explained as an alternative starting route. Maya cannot choose a fast path to a moving image or sound.

## Minor Observations

- `aria-labelledby="modal-title"` is only satisfied by some tab contents; Demos, Shortcuts, and Sparks do not appear to expose that ID.
- The dynamic Sparks accent globally recolors the shell although it belongs to a secondary tab.
- About’s “audio and visual” positioning excludes other product truths such as computation and interaction.
- The long Thanks content turns this bounded onboarding surface into an extended reading surface.
- Svelte’s analyzer also flags `activeTab` assignment in an `$effect` for review; it found no fixable syntax issues.

## Questions to Consider

- What is the one result a newcomer should see or hear within 30 seconds?
- If this modal were a patch instead of a resource directory, what could a newcomer manipulate before reading?
- Why are Thanks and Sparks top-level choices before someone has loaded a working example?
