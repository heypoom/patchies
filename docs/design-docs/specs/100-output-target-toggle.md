# 100. Output Target Toggle

## Problem

When a secondary output screen is open, frames **always** go to it — there's no way to switch back to background canvas output without closing the window. Users doing live performance need to dynamically toggle between "output to background" and "output to secondary screen" while both remain open.

## Solution

Add an `outputTarget` setting (`'background' | 'screen'`) that controls where rendered frames are routed, independent of whether the output window is open.

## Current Routing Logic (GLSystem.ts:264-268)

```typescript
if (this.ipcSystem.outputWindow === null) {
  this.backgroundOutputCanvasContext?.transferFromImageBitmap(data.outputBitmap);
} else {
  this.ipcSystem.sendRenderOutput(data.outputBitmap);
}
```

Decision is based solely on whether `outputWindow` exists. The new logic should check `outputTarget` preference instead.

## Implementation Plan

### 1. Add `outputTarget` store (`canvas.store.ts`)

```typescript
export type OutputTarget = 'background' | 'screen';
const OUTPUT_TARGET_STORAGE_KEY = 'patchies:outputTarget';

function loadOutputTarget(): OutputTarget {
  if (typeof localStorage === 'undefined') return 'background';
  const stored = localStorage.getItem(OUTPUT_TARGET_STORAGE_KEY);
  if (stored === 'screen') return 'screen';
  return 'background';
}

export const outputTarget = writable<OutputTarget>(loadOutputTarget());

outputTarget.subscribe((target) => {
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(OUTPUT_TARGET_STORAGE_KEY, target);
  }
});
```

### 2. Update `GLSystem.ts` — subscribe to store and use in routing

- Subscribe to `outputTarget` in GLSystem constructor (store the current value as a field).
- Update the `animationFrame` handler (line 264-268):

```typescript
if (this.outputTarget === 'screen' && this.ipcSystem.outputWindow !== null) {
  this.ipcSystem.sendRenderOutput(data.outputBitmap);
} else {
  this.backgroundOutputCanvasContext?.transferFromImageBitmap(data.outputBitmap);
}
```

- Update `syncOutputEnabled()` (line 688-696): enable background canvas when `outputTarget === 'background'` OR when output window is null, regardless of whether a screen window is open:

```typescript
private syncOutputEnabled() {
  const hasBgOutEdge = this.edges.some((edge) => edge.target.startsWith('bg.out'));
  const outputEnabled = this.overrideOutputNodeId !== null || hasBgOutEdge;

  const useBackground = this.outputTarget === 'background' || this.ipcSystem.outputWindow === null;
  if (useBackground) {
    isBackgroundOutputCanvasEnabled.set(outputEnabled);
  } else {
    isBackgroundOutputCanvasEnabled.set(false);
  }

  this.setOutputEnabled(outputEnabled);
}
```

### 3. Update `CommandPalette.svelte`

- Change existing `open-output-screen` handler: after opening the window, set `outputTarget` to `'screen'`.
- Add new command `toggle-output-target`:
  - Name: "Toggle Output Target"
  - Description: "Switch between background canvas and output screen"
  - Toggles `outputTarget` between `'background'` and `'screen'`
  - Call `glSystem.syncOutputEnabled()` (or re-subscribe) to update background canvas visibility

### 4. Update `VisualSettings.svelte`

Add a setting row with a dropdown for output target:
- Title: "Output target"
- Description: "Where to send rendered output"
- Options: `Background` / `Output Screen`
- Bound to `outputTarget` store

### 5. GLSystem needs to re-sync when `outputTarget` changes

Subscribe to `outputTarget` in GLSystem and call `syncOutputEnabled()` on change, so the background canvas visibility updates immediately when the user toggles.

## Files to Change

| File | Change |
|------|--------|
| `ui/src/stores/canvas.store.ts` | Add `outputTarget` store with localStorage persistence |
| `ui/src/lib/canvas/GLSystem.ts` | Subscribe to `outputTarget`, update routing + `syncOutputEnabled()` |
| `ui/src/lib/components/CommandPalette.svelte` | Add toggle command, update open-output-screen handler |
| `ui/src/lib/components/settings-modal/categories/VisualSettings.svelte` | Add output target dropdown |

## Behavior Summary

| outputTarget | Output window open? | Frames go to |
|---|---|---|
| `'background'` | no | background canvas |
| `'background'` | yes | background canvas |
| `'screen'` | no | background canvas (fallback) |
| `'screen'` | yes | output screen |

Opening the output screen sets `outputTarget` to `'screen'`. User can toggle back to `'background'` via command palette or settings without closing the window.
