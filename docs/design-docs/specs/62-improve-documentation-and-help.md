# 62. Improve Documentation for Patchies

## Motivation & Pain Points

- README.md is 2,400 lines long—requires CTRL+F to navigate, worse than man pages.
- Want documentation like Max/Pd without duplicating content. Patchies is already on the web via SvelteKit.
- Inconsistent in-app help patterns:
  - `trigger` uses a help button → side panel
  - `mqtt`, `ai.tts`, `tts`, `vdo.ninja.*` use tooltips for inlet/outlet messages
  - Both patterns are valuable, just need consistency without duplication.

## Design Decisions

### 1. TypeScript Schema as Single Source of Truth

Define inlet/outlet schemas once in TypeScript, use everywhere:

```ts
// src/lib/objects/schemas/trigger.ts
export const triggerSchema = {
  type: "trigger",
  category: "control",
  description: "Outputs bangs from right to left when triggered",
  inlets: [
    { id: "bang", description: "Trigger all outputs in order" },
    {
      id: "set",
      description: "Set values without triggering",
      args: ["...values"],
    },
  ],
  outlets: [
    { id: "1", description: "First outlet, outputs bang" },
    { id: "2", description: "Second outlet, outputs bang" },
  ],
} as const satisfies ObjectSchema;
```

**Used in:**

| Use                   | How                                       |
| --------------------- | ----------------------------------------- |
| ts-pattern matcher    | Import schema, derive valid message types |
| Inlet/outlet tooltips | Render `inlets[].description` on hover    |
| Help sidebar & /docs  | Combine with markdown prose               |

### 2. Markdown for Prose (No Schema Duplication)

```markdown
<!-- src/content/objects/trigger.md -->

# trigger

Outputs bangs from right to left when triggered.

## Usage

Send a `bang` to the inlet to fire all outlets from right to left...

## See Also

- [metro](./metro) - for timed bangs
```

Help sidebar/docs page loads both schema (for tables) and markdown (for prose).

### 3. Help Sidebar Tab

Add `help` tab to existing sidebar (files/presets/saves/packs). Shows:

- Inlet/outlet table (from schema)
- Markdown prose
- "Open help patch" button

When no node selected: searchable object index.

### 4. Interactive Help Patches

**URL:** `?help=trigger` fetches `/help-patches/trigger.json`

**Read-only mode:** Help patches do NOT persist to localStorage.

- `$isHelpMode` store controls autosave behavior
- Banner: "Help patch for trigger — changes won't be saved"

### 5. Object Browser: Help Mode Toggle

Extend object browser with mode toggle instead of relying on gestures:

```text
┌─────────────────────────────────┐
│ 🔍 Search objects...            │
├─────────────────────────────────┤
│  [Insert ✓]  [Help]             │  ← sticky toggle
├─────────────────────────────────┤
│  trigger                        │
│  metro                          │
└─────────────────────────────────┘
```

- **Insert mode** (default): tap to insert object
- **Help mode**: tap to open help for object
- Desktop: hover also reveals `?` icon on each object

### 6. Static Docs Route

`/docs/[object]` route loads same schema + markdown, renders full page with navigation. Allows linking, SEO, sharing.

## Migration Plan (Incremental)

1. **Infra**: Add `$isHelpMode` store, `?help=` query param handling, `/static/help-patches/` folder
2. **Pilot**: `trigger` end-to-end—schema, markdown, help patch, object browser `?` icon
3. **Extract pattern**: Create utilities for schema → tooltip, schema → table rendering
4. **Expand**: Add schemas to other objects, prioritizing complex ones (mqtt, ai.tts, etc.)
