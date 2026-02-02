# 59. Preset Packs

## Problem

Built-in presets are currently organized by object type (js, hydra, canvas, etc.), but user interest is organized by **use case** (MIDI, visuals, audio synthesis). This mismatch causes cognitive overload:

- `js` alone has 10 presets spanning MIDI, audio, and utilities
- Users see `midi-adsr-gain.js` and `waveshaper-distortion.js` even when doing visual-only work
- Presets bloat 3 UI surfaces: ObjectBrowser, Quick Insert (Enter), and Sidebar Preset Tree

Example: A VJ doing visual work doesn't need to see MIDI or audio-specific presets.

## Core Concept

**Preset Packs** - installable collections of presets grouped by use case, mirroring the Object Packs pattern. Installing a preset pack makes its presets visible in the UI.

Key principles:
- Preset packs are **mutually exclusive** - each preset belongs to one pack
- Preset packs depend on Object Packs - only visible if required objects are enabled
- "Starter Presets" enabled by default for new users

## Data Model

### Preset Pack Interface

```ts
// Add to src/stores/extensions.store.ts
interface PresetPack {
  id: string;                    // 'starter', 'midi', 'audio-synthesis'
  name: string;                  // 'Starter Presets'
  description: string;           // 'Essential presets for getting started'
  icon: string;                  // Lucide icon name
  requiredObjects: string[];     // Object types needed (filters pack visibility)
  presets: string[];             // Preset names to enable (e.g., 'logger.js', 'add.hydra')
}
```

### Store State

```ts
// Extend extensions.store.ts
const PRESET_STORAGE_KEY = 'patchies:enabled-preset-packs';
const DEFAULT_ENABLED_PRESET_PACKS = ['starter'];

export const enabledPresetPackIds = writable<string[]>(getInitialEnabledPresetPacks());

// Derived: visible presets based on enabled preset packs + enabled objects
export const enabledPresets = derived(
  [enabledPresetPackIds, enabledObjects],
  ([$enabledPresetPackIds, $enabledObjects]) => {
    const presets = new Set<string>();

    for (const packId of $enabledPresetPackIds) {
      const pack = BUILT_IN_PRESET_PACKS.find(p => p.id === packId);
      if (!pack) continue;

      // Only include if required objects are enabled
      const hasRequiredObjects = pack.requiredObjects.every(obj => $enabledObjects.has(obj));
      if (!hasRequiredObjects) continue;

      for (const preset of pack.presets) {
        presets.add(preset);
      }
    }

    return presets;
  }
);
```

## Proposed Built-in Preset Packs

| Pack | Description | Required Objects | Presets |
|------|-------------|------------------|---------|
| **Starter Presets** | Essential presets for getting started | js, hydra | logger.js, add.hydra, add-fft.hydra |
| **MIDI Presets** | MIDI routing and control | js, midi.in | midi-adsr-gain.js, midi-control-router.js, virtual-midi-keyboard.canvas |
| **Audio Synthesis** | Sound design utilities | js, osc~ | sawtooth-harmonics.js, waveshaper-distortion.js |
| **Animation** | Frame-based animation helpers | js, p5 | bang-every-frame.js, frame-counter.js, interval.js |
| **Livecoding Examples** | Example patches for livecoding | strudel, hydra, orca | (various strudel/orca presets) |
| **Canvas Widgets** | Interactive canvas components | canvas.dom | xy-pad.canvas, hsla-picker.canvas, rgba-picker.canvas, plotter.canvas |

### Preset Assignment (Draft)

**Starter Presets:**
- logger.js (debugging)
- add.hydra (common pattern)
- add-fft.hydra (audio-reactive)
- pipe-msg.js (utility)
- delay.js (utility)

**MIDI Presets:**
- midi-adsr-gain.js
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

## Dependency Handling

When an Object Pack is disabled after a Preset Pack is installed:

1. **Keep the Preset Pack installed** (don't auto-disable)
2. **Filter out unavailable presets** at display time
3. Show preset pack in Packs UI with note: "Some presets unavailable - requires [Pack Name]"

This is consistent with how object filtering already works and avoids surprising the user.

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
2. Update `QuickInsertObjectMenu.svelte` - filter preset suggestions
3. Update `PresetTreeView.svelte` - filter visible presets in sidebar

### Phase 3: UI Updates

1. Update `ExtensionsView.svelte`:
   - Add "Preset Packs" section below "Object Packs"
   - Reuse existing card component with preset pack data
   - Add visual distinction for unavailable packs
2. Update pack card to show availability warnings

### Phase 4: Content Curation

1. Review all built-in presets
2. Assign each preset to exactly one pack
3. Move obscure/personal presets to appropriate packs (or remove entirely)
4. Ensure "Starter Presets" has only universally useful presets

## Key Files to Modify

| File | Changes |
|------|---------|
| `src/stores/extensions.store.ts` | Add PresetPack interface, BUILT_IN_PRESET_PACKS, stores |
| `src/lib/components/sidebar/ExtensionsView.svelte` | Add Preset Packs section |
| `src/lib/components/object-browser/ObjectBrowserModal.svelte` | Filter presets by enabledPresets |
| `src/lib/components/insert-object/QuickInsertObjectMenu.svelte` | Filter preset suggestions |
| `src/lib/components/sidebar/PresetTreeView.svelte` | Filter visible presets |

## Verification Plan

1. Enable only "Starter Presets" → verify only those presets appear in ObjectBrowser
2. Enable "MIDI Presets" → verify MIDI presets appear
3. Disable "Audio" object pack → verify "Audio Synthesis" preset pack shows warning
4. Refresh page → verify settings persist
5. Quick Insert (Enter) → verify only enabled presets appear
6. Sidebar Preset Tree → verify filtering works

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
