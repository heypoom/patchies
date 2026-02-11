# CLAUDE.md

**Patchies**: Visual programming environment for audio-visual patches. Connect nodes (P5.js, Hydra, Strudel, GLSL, JavaScript) to build creative projects with real-time collaboration and message passing.

## Workflow Rules

- **CRITICAL**: Never start dev server manually. User will start if needed.
- **CRITICAL**: Never git commit or push for the user unless explicitly asked to do so. Wait for user review.
- Before implementing: update relevant spec files in `docs/design-docs/specs/`. Make sure specs are prefixed with numbers e.g. `50-foo-bar.md` and in the title too `# 50. Foo Bar`
- If asked explicitly to commit, write clear, short and concise commit messages.

## Core Stack

- **SvelteKit 5** + TypeScript
- **@xyflow/svelte** (node editor)
- **Bun** (package manager - use `bun install`)
- **Tailwind CSS 4** (Zinc/dark theme)
- **CodeMirror 6** (code editing)

## Development Commands

Run from `/ui` directory:

```bash
bun run dev              # Start dev server (USER starts this)
bun run build            # Production build
bun run check            # TypeScript & Svelte check
bun run lint             # Lint & format check
bun run test             # All tests
```

## Key Architectures

**Event Bus**: Type-safe system events (undo/redo, lifecycle, collaboration)

**Message System**: Max-style routing with `send()` / `recv()`, auto-cleanup on node deletion

**Rendering Pipeline**: FBO-based video chaining (P5 → Hydra → GLSL → Background). Topologically sorted render graphs.

**Audio System**: V2 AudioService (new) + V1 AudioSystem (legacy). Migrating nodes to V2 classes with async `create()` support.

**State**: Singletons (`MessageSystem`, `PatchiesEventBus`, `AudioSystem`) + Svelte stores + local storage auto-save

## Code Patterns

- **Always use `ts-pattern`**, never `switch` statements. This includes:
  - Conditional logic based on type/mode/state
  - Dynamic CSS class selection based on variants
  - Any branching on union types or enums

  ```ts
  // WRONG - never use switch
  switch (mode) {
    case "edit":
      return "bg-amber-600";
    case "multi":
      return "bg-blue-600";
    default:
      return "bg-purple-600";
  }

  // RIGHT - always use ts-pattern
  import { match } from "ts-pattern";
  match(mode)
    .with("edit", () => "bg-amber-600")
    .with("multi", () => "bg-blue-600")
    .otherwise(() => "bg-purple-600");
  ```

- Separate UI from business logic (manager pattern)
- TypeScript for all code
- Svelte 5: `$state`, `$props`, `$effect`, `$derived` (no `on:click`, use `onclick`)
- Prefer editing existing files
- **Persistence**: Never store localStorage keys or persistence logic in components. Create a dedicated store in `src/stores/` (see `preset-library.store.ts` or `help-view.store.ts` for pattern)

## Styling

- Tailwind classes only (no custom CSS)
- Zinc palette, dark theme
- Support `class` prop for component extension
- Icons: `@lucide/svelte`

## Node Development

### StandardHandle (Always use this)

```svelte
<StandardHandle
  port="inlet|outlet"
  type="video|audio|message" {/* optional */}
  id="..." {/* only if needed for disambiguation */}
  title="Description"
  total={count}
  index={idx}
/>
```

**Handle colors**: video=orange, audio=blue, message=gray

**Handle ID Generation** (StandardHandle.svelte:20-28):

- If `type` AND `id` both provided: `${type}-${portDir}-${id}` (e.g., `audio-in-0`)
- If only `type`: `${type}-${portDir}` (e.g., `message-in`, `video-out`)
- If only `id`: `${portDir}-${id}` (e.g., `in-0`, `out-1`)
- Otherwise: just `port` value

**Common patterns**:

- Simple single inlet/outlet: omit `id` → `message-in`, `audio-out`
- Multiple indexed: `id={index}` → `in-0`, `out-1`
- Labeled inputs: `id="audio-in"` → `audio-in-in`
- Complex dynamic (GLSL uniforms): `id=\`${index}-${name}-${type}\`` → computed handle names

**Auto-positioned**: Uses `getPortPosition()`, no manual styling needed

### New Node Checklist

**For visual/expression nodes (map, filter, uniq, etc.):**

1. Create component in `src/lib/components/nodes/`
2. Update `src/lib/nodes/node-types.ts`
3. Update `src/lib/nodes/defaultNodeData.ts`
4. Update the documentation and object schema (for visual objects)
5. Update `src/lib/components/object-browser/get-categorized-objects.ts` (add description + category)
6. **MUST** update AI object prompts in `src/lib/ai/`:
   - Add to `object-descriptions-types.ts` (OBJECT_TYPE_LIST)
   - Create prompt file in `object-prompts/` and register in `object-prompts/index.ts`
7. **For JavaScript-based nodes** (js, worker, p5, hydra, canvas, etc.): **MUST** update `src/lib/codemirror/patchies-completions.ts`:
   - Add node type to `nodeSpecificFunctions` for each API function it supports (fft, setTitle, flash, etc.)

**When adding new JS API functions** (e.g., `flash()`, `llm()`, `fft()`):

1. Add function definition to `patchiesAPICompletions` array in `src/lib/codemirror/patchies-completions.ts`
2. Add function name to `topLevelOnlyFunctions` set if it should only appear at top-level (not inside callbacks)
3. Add entry to `nodeSpecificFunctions` listing **every node type** that implements this function
4. Implement the function in each node's runner/context (JSRunner, worker context, hydra context, etc.)

**When adding file drag/drop support** (e.g., `.csd` → csound node):

1. Add MIME type in `src/lib/vfs/path-utils.ts` (e.g., `'.csd': 'text/x-csound-csd'`)
2. In `src/lib/canvas/CanvasDragDropManager.ts`:
   - Add extension mapping in `getNodeTypeFromExtension()` (for types browsers don't recognize)
   - Add MIME type mapping in `getNodeTypeFromMimeType()` (place specific types before generic `text/` catch-all)
   - Add VFS file handling in `getVfsFileNodeData()` for reading content
   - Add direct file handling in `getFileNodeData()` for native file drops

**For text control objects (delay, uniqby, etc.):**

1. Create class in `src/lib/objects/v2/nodes/` implementing `TextObjectV2`
2. Register in `src/lib/objects/v2/nodes/index.ts`
3. **MUST** add to object schemas in `src/lib/objects/schemas/index.ts`:
   - Import the node class
   - Add entry like `'kv': schemaFromNode(KVObject, 'control'),`
4. Add to `src/lib/extensions/object-packs.ts` in the appropriate pack
5. Update the documentation in `static/content/objects/{nodename}.md`
6. **MUST** use TypeBox schemas for message types (see pattern below)
7. **MUST** update AI object prompts in `src/lib/ai/`:
   - Add to `object-descriptions-types.ts` (OBJECT_TYPE_LIST)
   - Create prompt file in `object-prompts/` and register in `object-prompts/index.ts`

**TypeBox Schema Pattern for Text Objects:**

NEVER pattern-match against raw patterns like `P.string` or `P.array()`. Always use TypeBox schemas:

```typescript
import { Type } from '@sinclair/typebox';
import { msg } from '$lib/objects/schemas/helpers';
import { schema } from '$lib/objects/schemas/types';

// 1. Define TypeBox schemas for each message type
export const MyGet = msg('get', { key: Type.String() });
export const MySet = msg('set', { key: Type.String(), value: Type.Any() });

// 2. Create pre-wrapped matchers for ts-pattern
export const myMessages = {
  get: schema(MyGet),
  set: schema(MySet)
};

// 3. Use schemas in inlet definition
static inlets: ObjectInlet[] = [
  {
    name: 'command',
    type: 'message',
    description: 'Commands',
    messages: [
      { schema: MyGet, description: 'Get value by key' },
      { schema: MySet, description: 'Set value at key' }
    ]
  }
];

// 4. Match using schema matchers (NOT raw patterns)
match(data)
  .with(myMessages.get, ({ key }) => { /* ... */ })
  .with(myMessages.set, ({ key, value }) => { /* ... */ })
  .otherwise(() => { /* error */ });
```

See `KVObject.ts` for a complete example.

## Audio V2 Migration

**Pattern**: V2 nodes are self-contained classes implementing `AudioNodeV2` interface.

**Key rule**: Node name (e.g., `'gain~'`) appears **only once** in static `type` property.

**Optional methods**: `create()`, `send()`, `getAudioParam()`, `connect()`, `connectFrom()`, `destroy()`

**Don't hardcode node types in `AudioService`** - let nodes implement custom logic via methods.

**Async `create()`**: Supported for nodes needing resource loading (AudioWorklets, etc.)

**No manager names in AudioService**: If adding `if (nodeType === 'xyz~')`, add a method to the node class instead.

### New Audio Node Checklist

**ALWAYS complete ALL these steps when creating a new V2 audio node:**

1. Create node class in `src/lib/audio/v2/nodes/` implementing `AudioNodeV2`
2. Register in `src/lib/audio/v2/nodes/index.ts` (add to imports AND `AUDIO_NODES` array)
3. **MUST** add documentation in `ui/static/content/objects/{nodename}.md` (e.g., `send~.md`)
4. **MUST** add to object schemas in `src/lib/objects/schemas/index.ts`:
   - Import the node class
   - Add entry like `'send~': schemaFromNode(SendAudioNode, 'audio'),`
5. Add to `src/lib/extensions/object-packs.ts` in the appropriate pack (usually Audio)
6. If node has aliases, add `static aliases = ['s~']` to node class

## Testing

- **Unit**: Business logic, utilities, pure functions
- **Component**: Svelte rendering and interactions
- **E2E**: Critical user workflows
- **Type checking**: Strict mode coverage

## File Locations

- Nodes: `src/lib/components/nodes/`
- System managers: `src/lib/[audio|canvas|messages|eventbus]/`
- Stores: `src/stores/`
- Utilities: `src/lib/[rendering|save-load|objects]/`
- Specs: `docs/design-docs/specs/`
- Topic docs: `static/content/topics/` (update `src/routes/docs/docs-nav.ts` when adding new topics)
- Object docs: `static/content/objects/`

## Rendering Pipeline

The pipeline coordinates across multiple files:

- `generateImageWithGemini` → `capturePreviewFrame` → `GLSystem` → `renderWorker` → `fboRenderer`
- Use consistent parameter patterns (e.g., `customSize?: [number, number]`)
- Changes require updates across 5+ files

## Structured Reflections

After significant refactors, create `docs/reflections/YYYY-MM-DD-topic.md`:

- Objective (1-2 sentences)
- Key Challenges & Solutions
- What Could Be Better (specific impacts)
- Action Items (by timeframe)

**Consult existing reflections** before similar work.
