# 59. Preset Packs

## Problem

Built-in presets are currently organized by object type (js, hydra, canvas, etc.), but user interest is organized by **use case** (MIDI, visuals, audio synthesis). This mismatch causes cognitive overload:

- `js` alone has 10 presets spanning MIDI, audio, and utilities
- Users see `midi-adsr.js` and `waveshaper-distortion.js` even when doing visual-only work
- Presets bloat 3 UI surfaces: ObjectBrowser, Quick Insert (Enter), and Sidebar Preset Tree

Example: A VJ doing visual work doesn't need to see MIDI or audio-specific presets.

## Core Concept

**Preset Packs** - installable collections of presets grouped by use case, mirroring the Object Packs pattern. Installing a preset pack makes its presets visible in the UI.

Key principles:

- Preset packs are **mutually exclusive** - each preset belongs to one pack
- Preset packs depend on Object Packs - only visible if required objects are enabled
- "Starter Presets" enabled by default for new users
- Some presets are **object companions** - lightweight starter presets that appear automatically
  when their object is enabled because the locked Starter Presets pack is enabled by default
- Built-in preset browsers group presets by preset pack name, not by object type. For example,
  **Texture Generators** contains `Circle` and `Radial Ramp`.

## Data Model

### Preset Pack Interface

```ts
// Add to src/stores/extensions.store.ts
interface PresetPack {
  id: string; // 'starter', 'midi', 'audio-synthesis'
  name: string; // 'Starter Presets'
  description: string; // 'Essential presets for getting started'
  icon: string; // Lucide icon name
  requiredObjects: string[]; // Object types needed (filters pack visibility)
  presets: string[]; // Preset names to enable (e.g., 'logger.js', 'add.hydra')
}
```

### Store State

```ts
// Extend extensions.store.ts
const PRESET_STORAGE_KEY = "patchies:enabled-preset-packs";
const DEFAULT_ENABLED_PRESET_PACKS = ["starter"];

export const enabledPresetPackIds = writable<string[]>(
  getInitialEnabledPresetPacks(),
);

// Derived: visible presets based on enabled preset packs + enabled objects
export const enabledPresets = derived(
  [enabledPresetPackIds, enabledObjects],
  ([$enabledPresetPackIds, $enabledObjects]) => {
    const presets = new Set<string>();

    for (const packId of $enabledPresetPackIds) {
      const pack = BUILT_IN_PRESET_PACKS.find((p) => p.id === packId);
      if (!pack) continue;

      // Packs without requirements are always active.
      // Otherwise include if at least one required object is enabled.
      // Individual preset UI still filters by each preset's object type.
      const hasRequiredObjects =
        pack.requiredObjects.length === 0 ||
        pack.requiredObjects.some((obj) => $enabledObjects.has(obj));
      if (!hasRequiredObjects) continue;

      for (const preset of pack.presets) {
        presets.add(preset);
      }
    }

    return presets;
  },
);
```

## Proposed Built-in Preset Packs

| Pack                    | Description                             | Required Objects     | Presets                                                               |
| ----------------------- | --------------------------------------- | -------------------- | --------------------------------------------------------------------- |
| **Starter Presets**     | Essential presets and object companions | none                 | logger.js, glsl>, hydra>, regl>, swgl>, three>                        |
| **MIDI Presets**        | MIDI routing and control                | js, midi.in          | midi-adsr.js, midi-control-router.js, virtual-midi-keyboard.canvas    |
| **Audio Synthesis**     | Sound design utilities                  | js, osc~             | sawtooth-harmonics.js, waveshaper-distortion.js                       |
| **Animation**           | Frame-based animation helpers           | js, p5               | bang-every-frame.js, frame-counter.js, interval.js                    |
| **Livecoding Examples** | Example patches for livecoding          | strudel, hydra, orca | (various strudel/orca presets)                                        |
| **Canvas Widgets**      | Interactive canvas components           | canvas.dom           | xy-pad.canvas, hsla-picker.canvas, rgba-picker.canvas, plotter.canvas |

### Preset Assignment (Draft)

**Starter Presets:**

- logger.js (debugging)
- glsl> (object companion preset for `glsl`)
- hydra> (object companion preset for `hydra`)
- regl> (object companion preset for `regl`)
- swgl> (object companion preset for `swgl`)
- three> (object companion preset for `three`)

Object companion presets belong only to Starter Presets. They are visible when both of these are
true:

1. Starter Presets is enabled, which it is by default and locked for baseline visibility
2. The companion preset's object type is enabled by an object pack

Starter Presets has no pack-level object requirements so it never shows a "Requires ..." warning.
Availability is decided per preset when object browser/autocomplete surfaces filter by each preset's
object type.

For example, enabling the Video Synths object pack makes `glsl>`, `hydra>`, `regl>`, `swgl>`, and
`three>` visible without requiring the user to also enable a GLSL, Hydra, REGL, SwissGL, or Three.js
preset pack. Larger visual effect libraries remain in their own opt-in preset packs.

**MIDI Presets:**

- midi-adsr.js
- midi-control-router.js
- virtual-midi-keyboard.canvas

**Audio Synthesis:**

- sawtooth-harmonics.js
- waveshaper-distortion.js
- (chuck presets)
- (elementary presets)

**Animation:**

- bang-every-frame.js
- frame-counter.js
- interval.js

**Canvas Widgets:**

- xy-pad.canvas
- hsla-picker.canvas
- rgba-picker.canvas
- plotter.canvas
- paint.canvas
- fft.canvas

**Visual Effects:**

- fractal-tree.canvas
- various hydra presets
- various glsl presets
- three.js presets

**Hydra Demos:**

- Community Hydra sketches live in the **Hydra Demos** preset pack.
- Each sketch is a separate builtin preset file under `ui/src/lib/presets/builtin/hydra/`, matching
  the `glsl/` and `regl/` preset directory pattern.
- Sketch code keeps the original attribution comments intact.
- User-facing preset names use the artist-provided sketch title when present. If a sketch has no
  title, use the artist name for a single anonymous sketch by that artist, or a short descriptive
  name when the same artist has multiple untitled sketches.
- Imported legacy Hydra audio-reactive snippets must use Patchies FFT access (`fft().a`,
  `fft().f`, `fft().getEnergy(...)`) instead of Hydra's `a.fft`.

## Dependency Handling

When an Object Pack is disabled after a Preset Pack is installed:

1. **Keep the Preset Pack installed** (don't auto-disable)
2. **Filter out unavailable presets** at display time
3. Show preset pack in Packs UI with note: "Some presets unavailable - requires [Pack Name]"

This is consistent with how object filtering already works and avoids surprising the user.

## Browser Grouping

Built-in presets should use preset pack names as their visible folders/categories:

- Sidebar Preset Tree: `Built-in > Texture Generators > Circle`
- Object Browser preset categories: `Texture Generators`, `Texture Composite`, `Canvas Widgets`, etc.
- Search result locations and autocomplete descriptions should use the same pack folder path

User libraries keep their manually-created folder paths. Only the readonly built-in catalog is
derived from `BUILT_IN_PRESET_PACKS`.

Every built-in preset must be assigned to exactly one preset pack. Pack definitions must not point
at missing preset names.

## UI Design

### Packs Tab Layout

```
┌─────────────────────────────┐
│ Packs                    X  │
├─────────────────────────────┤
│ OBJECT PACKS                │
│ ┌─────────────────────────┐ │
│ │ ✓ Essentials      (8)   │ │
│ │ ✓ Visual         (15)   │ │
│ │ □ Audio          (24)   │ │
│ │ ...                     │ │
│ └─────────────────────────┘ │
│                             │
│ PRESET PACKS                │
│ ┌─────────────────────────┐ │
│ │ ✓ Starter Presets (5)   │ │
│ │ □ MIDI Presets    (3)   │ │
│ │ □ Audio Synthesis (2)   │ │
│ │ □ Animation       (3)   │ │
│ │ □ Canvas Widgets  (6)   │ │
│ │ ...                     │ │
│ └─────────────────────────┘ │
│                             │
│ [Enable All] [Reset]        │
└─────────────────────────────┘
```

### Preset Pack Card States

1. **Normal** - checkbox + name + count
2. **Partially available** - some required objects disabled, show warning icon
3. **Unavailable** - all required objects disabled, grayed out

## Implementation Phases

### Phase 1: Data Layer

1. Add `PresetPack` interface to `extensions.store.ts`
2. Define `BUILT_IN_PRESET_PACKS` constant
3. Add `enabledPresetPackIds` store with localStorage persistence
4. Add `enabledPresets` derived store
5. Add helper functions: `togglePresetPack()`, `enableAllPresetPacks()`, `disableAllPresetPacks()`

### Phase 2: Filtering Integration

1. Update `ObjectBrowserModal.svelte` - filter presets by `enabledPresets`
   - In Packs mode search, object/preset pack cards list their matching contents inline and do not open the expanded detail drawer on card click.
2. Update `QuickInsertObjectMenu.svelte` - filter preset suggestions
3. Update `PresetTreeView.svelte` - filter visible presets in sidebar
4. Group built-in preset folders/categories by preset pack name instead of preset object type

### Phase 3: UI Updates

1. Update `ExtensionsView.svelte`:
   - Add "Preset Packs" section below "Object Packs"
   - Reuse existing card component with preset pack data
   - In tile/grid pack cards, clicking the card body toggles enablement because pack availability is the primary action.
   - Expand/collapse moves to a dedicated chevron/details control so inspecting pack contents is secondary.
   - Locked or unavailable packs do not toggle from the card body; their lock/warning affordances explain the blocked state.
   - Add visual distinction for unavailable packs
2. Update pack card to show availability warnings

### Phase 4: Content Curation

1. Review all built-in presets
2. Assign each preset to exactly one pack
3. Move obscure/personal presets to appropriate packs (or remove entirely)
4. Ensure "Starter Presets" has only universally useful presets

## Key Files to Modify

| File                                                            | Changes                                                  |
| --------------------------------------------------------------- | -------------------------------------------------------- |
| `src/stores/extensions.store.ts`                                | Add PresetPack interface, BUILT_IN_PRESET_PACKS, stores  |
| `src/lib/components/sidebar/ExtensionsView.svelte`              | Add Preset Packs section                                 |
| `src/lib/components/object-browser/ObjectBrowserModal.svelte`   | Filter presets by enabledPresets                         |
| `src/lib/components/insert-object/QuickInsertObjectMenu.svelte` | Filter preset suggestions                                |
| `src/lib/components/sidebar/PresetTreeView.svelte`              | Filter visible presets                                   |
| `src/stores/preset-library.store.ts`                            | Build readonly built-in library from preset pack folders |
| `src/lib/extensions/preset-pack-index.ts`                       | Map built-in presets to their preset pack metadata       |

## Verification Plan

1. Enable only "Starter Presets" → verify only those presets appear in ObjectBrowser
2. Enable "MIDI Presets" → verify MIDI presets appear
3. Disable "Audio" object pack → verify "Audio Synthesis" preset pack shows warning
4. Refresh page → verify settings persist
5. Quick Insert (Enter) → verify only enabled presets appear
6. Sidebar Preset Tree → verify filtering works
7. Built-in preset tree → verify `Circle` appears under `Texture Generators`, not `glsl`

## Future Considerations

- **User preset packs**: Allow users to create their own pack collections
- **Community preset packs**: Share preset packs via import/export
- **Preset pack dependencies**: One preset pack could require another (not just objects)
- **Individual preset overrides**: Fine-grained control beyond pack-level (intentionally deferred)

## Open Questions

1. **Preset naming**: Should preset names include the pack? e.g., "logger.js" vs "starter/logger.js"
   - Decision: Keep flat names, pack is metadata only

2. **What about presets not in any pack?**:
   - Decision: All built-in presets must belong to a pack. Unassigned presets should be reviewed and either assigned or removed.

3. **Should "Starter Presets" be unremovable like "Essentials" object pack?**
   - Decision: Yes, for consistency. Users can always toggle it off but can't delete it.
