# 62. Improve Documentation for Patchies

## Motivation & Pain Points

- README.md is 2,400 lines long—requires CTRL+F to navigate, worse than man pages.
- Want documentation like Max/Pd without duplicating content. Patchies is already on the web via SvelteKit.
- Inconsistent in-app help patterns:
  - `trigger` uses a help button → side panel
  - `mqtt`, `ai.tts`, `tts`, `vdo.ninja.*` use tooltips for inlet/outlet messages
  - Both patterns are valuable, just need consistency without duplication.

## Implementation Status

| Feature                  | Status | Notes                                  |
| ------------------------ | ------ | -------------------------------------- |
| TypeScript schemas       | ✅     | `src/lib/objects/schemas/`             |
| Markdown prose           | ✅     | `static/content/objects/`              |
| Help sidebar tab         | ✅     | `HelpView.svelte`                      |
| Interactive help patches | ✅     | `?help=` query, `static/help-patches/` |
| Object browser help mode | ✅     | Icon toggle, greys out undocumented    |
| Static /docs route       | ✅     | `/docs/[object]`                       |
| Pilot object (trigger)   | ✅     | Schema + markdown + help patch         |

---

## Architecture

### 1. TypeScript Schema (Single Source of Truth)

```text
ui/src/lib/objects/schemas/
├── types.ts          # ObjectSchema, InletSchema, OutletSchema interfaces
├── trigger.ts        # Example: triggerSchema + TRIGGER_TYPE_SPECS
├── <object>.ts       # One file per object (or group related objects)
└── index.ts          # Re-exports + objectSchemas registry
```

### 2. Markdown Prose

```text
ui/static/content/objects/
└── trigger.md        # Extended documentation, usage examples, "See Also"
```

### 3. Help Patches (Optional)

```text
ui/static/help-patches/
└── trigger.json      # Interactive patch loaded via ?help=trigger
```

### 4. Key Files

| File                                                          | Purpose                              |
| ------------------------------------------------------------- | ------------------------------------ |
| `src/lib/objects/schemas/index.ts`                            | Schema registry (`objectSchemas`)    |
| `src/lib/composables/useObjectHelp.svelte.ts`                 | Fetches markdown + checks help patch |
| `src/lib/components/sidebar/HelpView.svelte`                  | Renders help in sidebar              |
| `src/lib/components/object-browser/ObjectBrowserModal.svelte` | Help mode toggle + greyed items      |
| `src/routes/docs/[object]/+page.svelte`                       | Static docs route                    |

---

## Object Browser Help Mode

The object browser has a help mode toggle (? icon button):

- **Insert mode** (default): Click to insert object into patch
- **Help mode**: Click to open help sidebar for that object
- Objects without schemas are greyed out and disabled in help mode
- Presets are hidden in help mode (no help for presets)
- Desktop: Hover reveals ? icon on each object (insert mode only)

---

## Checklist: Adding Help for a New Object

Follow these steps to add complete help documentation for an object like `trigger`:

### Step 1: Create the Schema File

Create `ui/src/lib/objects/schemas/<object>.ts`:

```ts
import type { ObjectSchema } from "./types";

export const myObjectSchema: ObjectSchema = {
  type: "myobject", // Must match the object type exactly
  category: "control", // One of: control, audio, video, network, ai, etc.
  description: "Short description shown in object browser",
  inlets: [
    {
      id: "message",
      description: "What this inlet accepts",
      args: ["optional", "arg", "names"], // Optional
      example: "send 42", // Optional
    },
  ],
  outlets: [
    {
      id: "0",
      description: "What this outlet emits",
    },
  ],
  tags: ["optional", "search", "tags"], // Optional
  hasDynamicOutlets: false, // Set true if outlets change based on args
};
```

### Step 2: Register the Schema

Edit `ui/src/lib/objects/schemas/index.ts`:

```ts
import { myObjectSchema } from "./myobject";

export const objectSchemas: ObjectSchemaRegistry = {
  trigger: triggerSchema,
  myobject: myObjectSchema, // Add your schema here
};
```

### Step 3: Create Markdown Documentation

Create `ui/static/content/objects/<object>.md`:

```markdown
The `myobject` does X and Y. Use it when you need Z.

## Usage

Send a message to the inlet to trigger the behavior...

## Examples

- Connect `metro` → `myobject` for periodic triggering
- Use with `expr` to calculate values

## See Also

- [trigger](./trigger) - for sequencing
- [metro](./metro) - for timing
```

### Step 4: Create Help Patch (Manual)

Create `ui/static/help-patches/<object>.json`:

1. Build an example patch in Patchies that demonstrates the object
2. Use "Save" to get the JSON
3. Copy the JSON to `static/help-patches/<object>.json`
4. The patch loads via `?help=<object>` in read-only mode

This will be done by the user, so don't do this for them.

### Step 5: Verify

1. Open object browser, enable Help mode (? button)
2. Your object should NOT be greyed out
3. Click it → sidebar shows schema info + markdown prose
4. Visit `/docs/objects/<object>` → static page renders correctly
5. If help patch exists: "Open Help Patch" button appears

---

## Topic Documentation

For general documentation (not object-specific), create topic pages at `/docs/<topic>`.

### Adding a Topic Page

1. Create `ui/static/content/topics/<topic>.md` with your content
2. Visit `/docs/<topic>` to view

Topic pages support:

- Full markdown with syntax-highlighted code blocks
- Links to object docs: `[p5](/docs/objects/p5)`
- Links to other topics: `[JavaScript Runner](/docs/javascript-runner)`

### Existing Topics

| Topic                | Description                          |
| -------------------- | ------------------------------------ |
| `javascript-runner`  | JSRunner API reference               |
| `canvas-interaction` | noDrag/noPan/noWheel/noInteract docs |

---

## Quick Reference: Schema Types

```ts
interface ObjectSchema {
  type: string; // Object name (e.g., 'trigger', 'metro')
  category: string; // Grouping (e.g., 'control', 'audio')
  description: string; // One-line summary
  inlets: InletSchema[]; // Input definitions
  outlets: OutletSchema[]; // Output definitions
  tags?: string[]; // Search keywords
  hasDynamicOutlets?: boolean; // True if outlets depend on arguments
}

interface InletSchema {
  id: string; // Inlet identifier
  description: string; // What it does
  args?: string[]; // Parameter names (optional)
  example?: string; // Example usage (optional)
}

interface OutletSchema {
  id: string; // Outlet identifier
  description: string; // What it outputs
}
```

---

## Priority Order for Adding Schemas

1. **Complex objects** with many inlets/messages: `mqtt`, `ai.tts`, `vdo.ninja.*`
2. **Core control objects**: `metro`, `loadbang`, `spigot`, `delay`
3. **Data manipulation**: `map`, `expr`, `filter`, `uniq`
4. **Audio objects**: `gain~`, `osc~`, etc.
5. **Everything else** incrementally

---

## File Locations Summary

| What              | Where                                                            |
| ----------------- | ---------------------------------------------------------------- |
| Schema types      | `ui/src/lib/objects/schemas/types.ts`                            |
| Schema files      | `ui/src/lib/objects/schemas/<object>.ts`                         |
| Schema registry   | `ui/src/lib/objects/schemas/index.ts`                            |
| Object markdown   | `ui/static/content/objects/<object>.md`                          |
| Topic markdown    | `ui/static/content/topics/<topic>.md`                            |
| Help patches      | `ui/static/help-patches/<object>.json`                           |
| Help sidebar      | `ui/src/lib/components/sidebar/HelpView.svelte`                  |
| Object browser    | `ui/src/lib/components/object-browser/ObjectBrowserModal.svelte` |
| Object docs route | `ui/src/routes/docs/objects/[object]/+page.svelte`               |
| Topic docs route  | `ui/src/routes/docs/[topic]/+page.svelte`                        |
