# 91. Dynamic Object Settings API

## Summary

A data-driven settings system that lets nodes declare a settings schema and renders a floating settings panel from it. Exposed as a `settings` API to JSRunner-enabled nodes, so user-authored objects can have their own configurable parameters. Built-in nodes can also adopt this system to replace hand-written settings components over time.

## Motivation

1. **Reduce boilerplate.** Each node currently implements its own settings panel (KnobSettings, BytebeatSettings, OrcaSettings, etc.) with duplicated positioning, close-button, and form rendering logic. A generic `<ObjectSettings>` component renders settings from a schema.

2. **User-authored settings.** JSRunner nodes (js, dom, textmode, p5, hydra, canvas, three) currently have no way to expose configurable parameters. With this API, user code can `settings.define(...)` a schema and the node automatically gets a gear icon and a floating settings panel.

3. **Persistence flexibility.** Settings can be stored at different levels depending on sensitivity: none (lost on reload), node data (exported with patch), or KV store (persisted locally, not exported).

## Design Decisions

| Decision                 | Choice                                         | Rationale                                                                                     |
| ------------------------ | ---------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Settings button location | Top toolbar (existing pattern)                 | Consistent with KnobNode, BytebeatNode, etc.                                                  |
| Schema definition timing | Static per run                                 | `define()` called once at top-level, like `setPortCount`. Re-running redefines.               |
| Change notification      | `get()` + `onChange(cb)`                       | `get()` for reading on run. `onChange()` for reactive updates.                                |
| onChange trigger         | On-commit (debounced)                          | Fires on blur for text, pointerup for slider, click for toggle/select. Not every keystroke.   |
| Revert                   | Single "Revert All" button                     | Resets all fields to defaults. Shown only when schema has defaults and current values differ. |
| Worker support           | Main-thread only (v1)                          | ✅ v2: `worker`, `canvas`, `hydra` supported via `workerSettingsProxy.ts`.                    |
| Field types (v1)         | number, string, boolean, select, color, slider | Covers most use cases. Extensible later.                                                      |

## Settings Schema

### Schema Type Definition

```typescript
type SettingsPersistence = 'none' | 'node' | 'kv'

interface SettingsFieldBase {
  key: string // unique identifier, used as storage key
  label: string // display label
  description?: string // tooltip text
  persistence?: SettingsPersistence // default: 'node'
}

interface NumberField extends SettingsFieldBase {
  type: 'number'
  default?: number
  min?: number
  max?: number
  step?: number
}

interface StringField extends SettingsFieldBase {
  type: 'string'
  default?: string
  placeholder?: string
}

interface BooleanField extends SettingsFieldBase {
  type: 'boolean'
  default?: boolean
}

interface SelectField extends SettingsFieldBase {
  type: 'select'
  default?: string
  options: Array<{label: string; value: string; description?: string}>
}

interface ColorField extends SettingsFieldBase {
  type: 'color'
  default?: string // hex string, e.g. '#ff0000'
  presets?: string[] // optional swatch grid (PostItNode-style), falls back to native picker
}

interface SliderField extends SettingsFieldBase {
  type: 'slider'
  default?: number
  min: number
  max: number
  step?: number
}

type SettingsField =
  | NumberField
  | StringField
  | BooleanField
  | SelectField
  | ColorField
  | SliderField

type SettingsSchema = SettingsField[]
```

### Storage in Node Data

Two new keys are added to node data:

```typescript
// node.data.settingsSchema — the schema definition (SettingsSchema)
// node.data.settings — the user's current values ({ [key: string]: unknown })
```

Fields with `persistence: 'none'` are NOT stored in `settings` — they exist only in runtime memory (a Map held by the settings manager). On reload, values are lost.

Fields with `persistence: 'kv'` are stored in the node's KV store under the key `settings:${key}`. They are NOT in `settings` either, so they don't get exported with the patch.

Fields with `persistence: 'node'` (the default) are stored in `settings` and exported with the patch.

## JSRunner API

### `settings` object

Injected as a top-level variable in JSRunner-enabled nodes, alongside `kv`, `send`, etc.

```javascript
// Define the settings schema. Array order = render order.
settings.define([
  {
    key: 'bpm',
    label: 'BPM',
    type: 'slider',
    min: 20,
    max: 300,
    step: 1,
    default: 120,
  },
  {
    key: 'mode',
    label: 'Mode',
    type: 'select',
    default: 'euclidean',
    options: [
      {
        label: 'Euclidean',
        value: 'euclidean',
        description: 'Distribute hits evenly across steps',
      },
      {
        label: 'Random',
        value: 'random',
        description: 'Randomize hits each cycle',
      },
      {label: 'Manual', value: 'manual', description: 'Set each step manually'},
    ],
  },
  {
    key: 'mute',
    label: 'Mute output',
    type: 'boolean',
    default: false,
  },
  {
    key: 'apiKey',
    label: 'API Key',
    type: 'string',
    placeholder: 'sk-...',
    persistence: 'kv', // not exported, persisted in IndexedDB
  },
  {
    key: 'color',
    label: 'Accent Color',
    type: 'color',
    default: '#6366f1',
    presets: ['#ef4444', '#f59e0b', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899'],
  },
])

// Read a setting value. Returns the current value, or default, or undefined.
const bpm = settings.get('bpm') // 120
const mode = settings.get('mode') // 'euclidean'

// Read all settings as an object
const all = settings.getAll() // { bpm: 120, mode: 'euclidean', ... }

// Listen for changes (fires on-commit: blur for text, pointerup for slider, click for toggle/select)
settings.onChange((key, value, allValues) => {
  if (key === 'bpm') {
    updateTempo(value)
  }
})

// Clear all settings values (reset to defaults or undefined)
settings.clear()
```

### API Shape

```typescript
interface SettingsAPI {
  define(schema: SettingsField[]): void
  get(key: string): unknown
  getAll(): Record<string, unknown>
  onChange(
    callback: (
      key: string,
      value: unknown,
      allValues: Record<string, unknown>,
    ) => void,
  ): void
  clear(): void
}
```

### Behavior Details

- **`define(schema)`**: Stores schema in `node.data.settingsSchema`. If `settings` already has persisted values from a previous run, they are preserved (schema change doesn't wipe values). New fields get their defaults. Removed fields' values are kept in storage but ignored (no data loss on schema change). Calling `define` also makes the settings gear icon visible.

- **`get(key)`**: Resolution order: (1) user-set value from the appropriate store, (2) `default` from schema, (3) `undefined`. Synchronous for `node` and `none` persistence. For `kv` persistence, `get` returns the cached value (loaded at define time). KV values are loaded asynchronously when `define()` is called, and the cache is populated before user code continues (since `define` triggers an async load internally, but JSRunner's async wrapper handles this).

- **`onChange(callback)`**: Registers a callback. The callback is invoked on-commit (not every keystroke). Multiple `onChange` calls register multiple callbacks. Callbacks are cleaned up when the node is re-executed (same lifecycle as `onMessage`/`setInterval`).

- **`clear()`**: Removes all user-set values. Fields revert to their defaults. `none` and KV values are also cleared.

## `<ObjectSettings>` Component

A generic Svelte component that renders a settings panel from a schema.

### Props

```typescript
interface ObjectSettingsProps {
  schema: SettingsSchema
  values: Record<string, unknown>
  onValueChange: (key: string, value: unknown) => void
  onRevertAll: () => void
  onClose: () => void
}
```

### Rendering Rules

Each field type maps to a UI element:

| Field Type | Rendered As                                                                                     |
| ---------- | ----------------------------------------------------------------------------------------------- |
| `number`   | `<input type="number">` styled like ScopeNode/KnobSettings inputs                               |
| `string`   | `<input type="text">` with placeholder, styled like SequencerSettings track name input          |
| `boolean`  | Compact checkbox button (SequencerSettings pattern), NOT bits-ui Switch                         |
| `select`   | Pill button group (SequencerSettings output/clock mode pattern)                                 |
| `color`    | Color swatch grid (PostItNode pattern) or swatch+picker (SequencerSettings track color pattern) |
| `slider`   | `<SettingsSlider>` component (`$lib/components/SettingsSlider.svelte`) with label+value header  |

### UI Patterns (Reference Components)

The `<ObjectSettings>` component MUST follow the established UI patterns from existing settings panels. These are the canonical patterns:

**Slider fields** — use `<SettingsSlider>` with a label+value header row (ScopeNode pattern):

```svelte
<div>
  <div class="mb-1 flex items-center justify-between">
    <span class="text-xs font-medium text-zinc-300">{field.label}</span>
    <span class="text-xs text-zinc-500">{displayValue}</span>
  </div>
  <SettingsSlider
    min={field.min} max={field.max} step={field.step}
    value={currentValue}
    onchange={handleChange}
    onpointerdown={tracker.onFocus}
    onpointerup={tracker.onBlur}
  />
</div>
```

**Select fields** — pill button group, NOT a `<select>` dropdown (SequencerSettings/ScopeNode pattern):

```svelte
<div>
  <label class="mb-2 block text-xs font-medium text-zinc-300">{field.label}</label>
  <div class="flex flex-wrap gap-1">
    {#each field.options as option}
      <button
        onclick={() => handleChange(option.value)}
        class="cursor-pointer rounded px-2 py-1 text-xs transition-colors"
        class:bg-zinc-600={value === option.value}
        class:text-white={value === option.value}
        class:bg-zinc-800={value !== option.value}
        class:text-zinc-300={value !== option.value}
        class:hover:bg-zinc-700={value !== option.value}
      >
        {option.label}
      </button>
    {/each}
  </div>
</div>
```

If the field has `description` on options, wrap each button in `<Tooltip.Root>` (like SequencerSettings output modes).

**Boolean fields** — compact checkbox button (SequencerSettings velocity/timeline pattern):

```svelte
<button
  class="flex cursor-pointer items-center gap-1.5 transition-colors"
  onclick={() => handleChange(!value)}
>
  <div
    class="h-3 w-3 shrink-0 rounded-sm border transition-colors"
    class:border-zinc-500={value}
    class:bg-zinc-500={value}
    class:border-zinc-600={!value}
  ></div>
  <span class="text-xs" class:text-zinc-400={value} class:text-zinc-500={!value}>
    {field.label}
  </span>
</button>
```

**Color fields** — swatch grid (PostItNode pattern):

```svelte
<div>
  <label class="mb-2 block text-xs font-medium text-zinc-300">{field.label}</label>
  <div class="flex flex-wrap gap-2">
    {#each field.presets as preset}
      <button
        onclick={() => handleChange(preset)}
        class={[
          'h-6 w-6 cursor-pointer rounded-full border-2 transition-all',
          value === preset
            ? 'scale-110 border-white shadow-md'
            : 'border-transparent hover:scale-105 hover:border-zinc-400'
        ]}
        style="background-color: {preset};"
      ></button>
    {/each}
  </div>
</div>
```

If the field has no presets, fall back to a native `<input type="color">` wrapped in a swatch label (SequencerSettings track color pattern).

**String fields** — text input:

```svelte
<input
  type="text"
  value={currentValue}
  placeholder={field.placeholder}
  class="nodrag min-w-0 w-full rounded bg-zinc-800 px-1.5 py-0.5 font-mono text-xs text-zinc-300
         outline-none focus:ring-1 focus:ring-zinc-500"
/>
```

**Number fields** — number input:

```svelte
<input
  type="number"
  value={currentValue}
  min={field.min} max={field.max} step={field.step}
  class="nodrag w-full rounded border border-zinc-600 bg-zinc-800 px-2 py-1 text-xs text-zinc-100"
/>
```

### Layout

- Container: `nodrag w-48 rounded-md border border-zinc-600 bg-zinc-900 p-4 shadow-xl` (matches ScopeNode/PostItNode width)
- Fields: `space-y-4` vertical stack within a `flex flex-col gap-3` wrapper
- Labels: `text-xs font-medium text-zinc-300` (block, `mb-1` or `mb-2`)
- Description (if present): rendered as Tooltip on the label text, NOT inline text
- Close button bar: `absolute -top-7 left-0 flex w-full justify-end gap-x-1` with `h-6 w-6 cursor-pointer rounded bg-zinc-950 p-1 text-zinc-300 hover:bg-zinc-700` buttons (matches ScopeNode)
- Revert All button: `<RotateCcw>` icon in the close button bar (same row as X button), matching ScopeNode's reset button pattern. Only visible when at least one value differs from its default.

### Collapsible Sections (Future)

Following ScopeNode's "Advanced" accordion pattern using `<Collapsible.Root>`:

```svelte
<Collapsible.Root bind:open={sectionOpen}>
  <Collapsible.Trigger
    class="flex w-full cursor-pointer items-center gap-1 rounded px-1 py-0.5
           text-xs text-zinc-400 hover:bg-zinc-800 hover:text-zinc-300"
  >
    <ChevronRight class={['h-3 w-3 transition-transform', sectionOpen && 'rotate-90']} />
    <span>{sectionLabel}</span>
  </Collapsible.Trigger>
  <Collapsible.Content class="mt-2 space-y-4">
    <!-- fields in this section -->
  </Collapsible.Content>
</Collapsible.Root>
```

This is not in v1 scope but informs future `group` field type design.

### Undo/Redo

Settings changes go through `useNodeDataTracker`. The `onValueChange` callback updates `node.data.settings` via `updateNodeData`, and the component uses `tracker.commit()` for discrete fields and `tracker.track()` for continuous fields (slider, number, string).

For `kv` and `none` fields, undo/redo is NOT supported (these are outside node data).

## Implementation Plan

### Phase 1: Schema + Component

1. **Define types** in `ui/src/lib/settings/types.ts` — `SettingsField`, `SettingsSchema`, `SettingsPersistence`
2. **Create `<ObjectSettings>`** component in `ui/src/lib/components/settings/ObjectSettings.svelte` — renders schema to form
3. **Create `SettingsManager`** class in `ui/src/lib/settings/SettingsManager.ts` — handles value resolution (node data / kv / none), change callbacks, revert logic

### Phase 2: JSRunner Integration

4. **Create `createSettingsAPI()`** factory in `ui/src/lib/settings/create-settings-api.ts` — creates the `settings` object for user code. Receives `nodeId`, `updateNodeData`, `kvStore`.
5. **Inject into JSRunner** — add `settings` to `functionParams`/`functionArgs` in `JSRunner.executeJavaScript()`
6. **Wire up onChange** — `ObjectSettings` component dispatches changes to `SettingsManager`, which invokes registered callbacks
7. **Add settings gear icon** to JSRunner-based nodes — show gear when `node.data.settingsSchema` is defined

### Phase 3: Node Component Integration

8. **Create shared settings panel wrapper** — extract the positioning logic (absolute, `left: contentWidth + 10`, close button bar) into a reusable component, since every node duplicates this
9. **Integrate with CodeBlockBase** — JSBlockNode and similar code-block nodes gain the settings gear automatically when schema is defined
10. **Update `patchies-completions.ts`** — add `settings.define`, `settings.get`, `settings.getAll`, `settings.onChange`, `settings.clear` completions

### Phase 4: Migration (gradual, not blocking)

11. Migrate existing hand-written settings (KnobSettings, BytebeatSettings, etc.) to use `<ObjectSettings>` where schemas are simple enough. Complex settings (OrcaSettings, SequencerSettings) may keep custom components.

## Node Data Changes

`defaultNodeData.ts` additions for JSRunner-enabled node types:

```typescript
// No defaults needed — these are dynamically set by user code
// settingsSchema: undefined
// settings: undefined
```

When `settings.define()` is called, node data is updated:

```typescript
updateNodeData(nodeId, {
  settingsSchema: schema,
  settings: { ...buildDefaults(schema), ...existingValues },
})
```

## Event Flow

```
User code calls settings.define(schema)
  → updateNodeData(nodeId, { settingsSchema: schema })
  → Svelte reactivity shows gear icon

User clicks gear icon
  → showSettings = true
  → <ObjectSettings> renders from node.data.settingsSchema

User changes a field value (on-commit)
  → ObjectSettings calls onValueChange(key, value)
  → SettingsManager updates appropriate store (node data / kv / none)
  → SettingsManager invokes onChange callbacks
  → tracker.commit() records undo/redo (node persistence only)

User clicks "Revert All"
  → All values reset to schema defaults
  → onChange callbacks fire for each changed field
  → tracker.commit() records the revert

User re-runs code
  → settings.define(schema) re-registers schema
  → Existing values preserved (no data loss)
  → New onChange callbacks replace old ones
```

## Edge Cases

- **Schema changes between runs**: If user removes a field from the schema, the stored value is kept but ignored. If they re-add the field, the old value is restored. This prevents accidental data loss during iteration.

- **No schema defined**: If `settings.define()` is never called, no gear icon appears. `settings.get()` returns `undefined`.

- **KV persistence async loading**: When `define()` is called with `kv` fields, values must be loaded from IndexedDB. Since JSRunner wraps code in an async function, `define()` can be async internally. The settings API caches loaded KV values so subsequent `get()` calls are synchronous.

- **Node duplication**: When a node is duplicated, `settingsSchema` and `settings` are copied (they're in node data). `none` values are lost. KV values are NOT copied (they're scoped to node ID).

- **Node deletion**: Cleanup removes onChange callbacks (via `onCleanup`). KV settings values persist in IndexedDB until explicit cleanup (same as existing KV behavior).

## Future Extensions

- ~~**Worker/render-worker support**: Add postMessage plumbing for `settings` API in WorkerNode and render worker nodes.~~ ✅ Implemented: `worker`, `canvas`, and `hydra` nodes now support the settings API via `workerSettingsProxy.ts` shared utility + postMessage bridging through `WorkerNodeSystem`/`GLSystem`.
- **Field groups/sections**: `group` field type with collapsible sections using the ScopeNode Collapsible pattern (see "Collapsible Sections" above).
- **Conditional visibility**: Show/hide fields based on other field values (e.g., show "steps" only when mode is "euclidean").
- **Custom field types**: File picker (VFS), code snippet, MIDI mapping, etc.
- **Built-in node migration**: Replace hand-written settings components with schema-driven ones where feasible.
- **Select option descriptions**: Already supported in v1 schema (`description` on select options renders as Tooltip), but could extend to richer help text.
