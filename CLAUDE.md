# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Patchies** is a visual programming environment for creating interactive audio-visual patches on the web. Users can connect nodes to build complex creative coding projects using familiar tools like P5.js, Hydra, Strudel, GLSL shaders, and JavaScript. The project emphasizes real-time collaboration, message passing between nodes, video chaining, and embeddable shareable experiences.

## Architecture Overview

### Core Stack

- **SvelteKit 5** with TypeScript (web application)
- **@xyflow/svelte** for the visual node editor
- **Bun** as package manager (use `bun install`, not `npm install`)
- **Tailwind CSS 4** with Zinc color scheme and dark theme
- **CodeMirror 6** for in-browser code editing
- Creative coding integrations: **p5.js**, **Hydra**, **Strudel**, **GLSL**, **Butterchurn**

### Key System Architectures

**Event-Driven Architecture**: The `PatchiesEventBus` (singleton) handles system-wide events with type-safe event listeners. This decouples components and enables features like undo/redo, node lifecycle events, and real-time collaboration.

**Message Passing System**: The `MessageSystem` (singleton) enables Max/MSP-style message routing between nodes using `send()` and `recv()`. Messages flow through XY Flow edges, supporting typed inlets/outlets and automatic cleanup on node deletion.

**Rendering Pipeline**: The `graphUtils` module builds render graphs from XY Flow nodes, performs topological sorting, and handles FBO (Frame Buffer Object) rendering chains for video effects. Supports video chaining (P5 → Hydra → GLSL) through texture passing.

**Live Code Execution**: Each node type has specialized managers (e.g., `P5Manager`, `JSCanvasManager`) that provide sandboxed execution environments with curated APIs exposed via JavaScript's `with` statement.

**Save/Load System**: Patches are serialized as JSON with version tracking (`serialize-patch.ts`). Local storage automatically saves work with conflict resolution.

## Development Commands

All commands run from the `/ui` directory:

```bash
# Development
bun run dev                 # Start development server
bun run build              # Production build
bun run preview            # Preview production build

# Code Quality
bun run format             # Format with Prettier
bun run lint               # Lint and format check
bun run check              # TypeScript and Svelte type check
bun run check:watch        # Continuous type checking

# Testing
bun run test:unit          # Run Vitest unit tests
bun run test:e2e           # Run Playwright E2E tests
bun run test               # Run all tests
```

## Key Architectural Systems

### Node Types & Capabilities

- **Visual nodes**: `p5`, `glsl`, `hydra`, `butterchurn`, `canvas`, `swissgl` (support video chaining)
- **Audio nodes**: `strudel` (live coding music), AI music generation
- **Control nodes**: `js` (JavaScript blocks), `slider`, `bang`, `message`
- **AI nodes**: `ai.txt`, `ai.img`, `ai.tts`, `ai.music` (can be hidden via settings)
- **I/O nodes**: `midi.in`, `midi.out`, `bg.out` (background output)

### Message Passing Architecture

```typescript
// In any JavaScript-based node:
send(data, { to: 0 }); // Send to specific outlet number
recv((data, meta) => {
  // meta contains { source, inlet, outlet, inletKey, outletKey }
});
```

The `MessageSystem` handles routing through XY Flow edges with handle-based targeting. Messages support outlet filtering and automatic node lifecycle cleanup.

### Video Chaining System

Visual nodes can be chained together using orange video inlets/outlets:

- Connect P5.js output → Hydra input → GLSL input → Background output
- Implemented via FBO (Frame Buffer Object) texture passing
- Render graphs are topologically sorted to determine execution order
- Background output (`bg.out`) determines final render target

### State Management

- **Global singletons**: `MessageSystem`, `PatchiesEventBus`, `AudioSystem`
- **Svelte stores**: Canvas state, MIDI state, renderer state, UI state (in `/src/stores/`)
- **Local storage**: Auto-saving patches with conflict resolution
- **Context API**: Component-level state sharing (avoid prop drilling)

## Core System Classes

### Message System (`src/lib/messages/MessageSystem.ts`)

- Singleton pattern for inter-node communication
- Handles XY Flow edge updates and connection mapping
- Manages message queues per node with error isolation
- Provides `setInterval` with automatic cleanup

### Event Bus (`src/lib/eventbus/PatchiesEventBus.ts`)

- Type-safe event system for system-wide notifications
- Handles node lifecycle, undo/redo, and collaboration events
- Singleton pattern with strongly typed event listeners

### Render Graph (`src/lib/rendering/graphUtils.ts`)

- Builds render graphs from XY Flow nodes/edges
- Performs topological sorting for correct render order
- Filters FBO-compatible nodes for video chaining
- Detects circular dependencies and output nodes

### Audio System (`src/lib/audio/AudioSystem.ts`)

- Manages Web Audio API context and analysis
- Handles FFT data for audio visualization
- Coordinates with Strudel for live coding music

## Development Guidelines

### Code Patterns

- Use `ts-pattern` instead of `switch` statements always
- Prefer editing existing files over creating new ones
- Separate UI components from business logic (manager pattern)
- Use TypeScript for all new code with proper typing

### Svelte 5 Requirements

- Only use Svelte 5 rune syntax: `$state`, `$props`, `$effect`, `$derived`
- Read `docs/llms/svelte-llms-small.txt` for syntax reference
- Use `onclick` instead of `on:click` for events
- Components use `{@render children()}` for slot content

### Workflow

- Before implementing, update relevant spec files in `docs/design-docs/specs/`
- Write concise, clear commit messages
- Never start dev server to test - use type checking and build
- Always run `bun run check` before committing

### Styling

- Use Tailwind classes over custom CSS
- Follow Zinc color palette for dark theme
- Support `class` prop for component extension
- Icons from `@iconify/svelte` or `@lucide/svelte`

## Testing Strategy

- **Unit tests**: Core business logic, utilities, and pure functions
- **Component tests**: Svelte component rendering and interactions
- **E2E tests**: Critical user workflows like patch creation and node connections
- **Type checking**: Comprehensive TypeScript coverage with strict mode

## Key File Locations

- Node components: `src/lib/components/nodes/`
- System managers: `src/lib/[audio|canvas|messages|eventbus]/`
- Stores: `src/stores/`
- Utilities: `src/lib/[rendering|save-load|objects]/`
- Specs: `docs/design-docs/specs/`
- always use ts-pattern for matching. never ever use switch cases.
- always update README.md after adding an audio node or visual node

## Rendering Pipeline Architecture

### Deep Pipeline Coordination

The rendering system requires careful coordination across multiple files:

- `generateImageWithGemini` → `capturePreviewFrame` → `GLSystem` → `renderWorker` → `fboRenderer`
- Use consistent parameter patterns (e.g., `customSize?: [number, number]`) throughout the entire chain
- Changes to rendering capabilities require updates across 5+ files simultaneously

### Frame Capture System

- `fboRenderer.renderNodePreview()` accepts `customSize?: [number, number]` for custom resolution capture
- `capturePreviewFrame()` supports high-resolution input for AI image-to-image workflows
- Default preview size is calculated from output size with `PREVIEW_SCALE_FACTOR`

## Structured Reflections

After completing significant refactors or architectural changes:

1. **Create a reflection document** in `docs/reflections/` named `YYYY-MM-DD-topic.md`
2. **Keep it concise** - 1-2 pages maximum
3. **Focus on learnings** - What went wrong, what could be improved, action items
4. **Skip the obvious wins** - Briefly acknowledge successes, focus on challenges
5. **Include action items** - Clear next steps with timeframes

**Template structure:**

- Objective (1-2 sentences)
- Key Challenges & Solutions (bullet points)
- What Could Be Better (specific issues with impact assessment)
- Action Items (categorized by timeframe)

**Consult existing reflections** in `docs/reflections/` before starting similar work.

## Node Development Patterns

### UI Design Guidelines

- **Minimalistic Floating Layout**: Follow `ai.tts` pattern for nodes without code editors
- **No Solid Backgrounds**: Use transparent headers with `absolute -top-7` positioning
- **Hover Interactions**: Buttons should have `opacity-0 group-hover:opacity-100` for clean appearance

### StandardHandle Usage

**Always use `StandardHandle` instead of raw `Handle` or `VideoHandle`**:

```svelte
import StandardHandle from '$lib/components/StandardHandle.svelte';

<StandardHandle
    port="inlet|outlet"
    type="video|audio|message" (optional - omit for generic gray handles)
    id="..." (optional - only for disambiguation/numbering)
    title="Handle description"
    total={totalHandles}
    index={handleIndex}
    class="" (optional styling)
/>
```

**Handle Type Color Coding**:

- `type="video"` → Orange handles (`!bg-orange-500`)
- `type="audio"` → Blue handles (`!bg-blue-500`)
- `type="message"` → Gray handles (`!bg-gray-500`)
- No type → Default gray handles

**ID Construction Rules**:

- StandardHandle auto-generates IDs from `port + type + id`
- `port="inlet"` + `type="video"` + `id="0"` → `"video-in-0"`
- `port="outlet"` + `type="audio"` → `"audio-out"` (no id needed)
- Only include `id` prop when disambiguation needed (numbered ports, complex cases)

**Position Handling**:

- StandardHandle automatically calculates position using `getPortPosition(total, index)`
- No need for manual `style` or `position` attributes
- Handles `z-1` and `!absolute` positioning internally

### Message Port Standards

- **Input Handles**: Use `StandardHandle` with `port="inlet"` and `type="message"`
- **Output Handles**: Send completion signals with `messageContext.send({ type: 'bang' }, { to: 0 })`
- **Handle Consistency**: All nodes use StandardHandle for consistent styling and behavior

### Node Integration Checklist

When adding new nodes, always update:

1. `src/lib/nodes/node-types.ts` - Add import and node type mapping
2. `src/lib/nodes/defaultNodeData.ts` - Add default data structure
3. `README.md` - Update node list for audio/visual nodes
