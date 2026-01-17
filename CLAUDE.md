# CLAUDE.md

**Patchies**: Visual programming environment for audio-visual patches. Connect nodes (P5.js, Hydra, Strudel, GLSL, JavaScript) to build creative projects with real-time collaboration and message passing.

## Workflow Rules

- **CRITICAL**: Never start dev server manually. User will start if needed.
- **CRITICAL**: Never git commit or push for the user unless explicitly asked to do so. Wait for user review.
- Before implementing: update relevant spec files in `docs/design-docs/specs/`
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

- **Always use `ts-pattern`**, never `switch` statements
- Separate UI from business logic (manager pattern)
- TypeScript for all code
- Svelte 5: `$state`, `$props`, `$effect`, `$derived` (no `on:click`, use `onclick`)
- Prefer editing existing files

## Styling

- Tailwind classes only (no custom CSS)
- Zinc palette, dark theme
- Support `class` prop for component extension
- Icons: `@iconify/svelte` or `@lucide/svelte`

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

1. Update `src/lib/nodes/node-types.ts`
2. Update `src/lib/nodes/defaultNodeData.ts`
3. Update `README.md` (for audio/visual nodes)

## Audio V2 Migration

**Pattern**: V2 nodes are self-contained classes implementing `AudioNodeV2` interface.

**Key rule**: Node name (e.g., `'gain~'`) appears **only once** in static `type` property.

**Optional methods**: `create()`, `send()`, `getAudioParam()`, `connect()`, `connectFrom()`, `destroy()`

**Don't hardcode node types in `AudioService`** - let nodes implement custom logic via methods.

**Async `create()`**: Supported for nodes needing resource loading (AudioWorklets, etc.)

**No manager names in AudioService**: If adding `if (nodeType === 'xyz~')`, add a method to the node class instead.

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
