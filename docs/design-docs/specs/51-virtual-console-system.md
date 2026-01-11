# 51. Virtual Console System

## Problem Statement

Currently, most objects in Patchies log errors and messages to the browser DevTools console using `console.log`, `console.error`, and `console.warn`. This creates several critical UX issues:

### Current Issues

1. **No visual feedback for many nodes**

   - `p5` objects have no error feedback - impossible to debug without DevTools
   - `glsl` shader compilation errors only go to DevTools
   - `canvas` and `canvas.dom` errors are invisible
   - Audio nodes (`dsp~`, `sonic~`, `tone~`, `elem~`) log to DevTools only

2. **Poor UX in existing consoles** (e.g., `js`, `python`)

   - Cannot drag-select text across console lines
   - Scrolling doesn't work properly in console area
   - JSON objects are not colorized or interactive
   - Error objects lose structure (e.g., `console.error({a: 1})` becomes string)
   - Console windows are fixed-size, not resizable

3. **Debugging nightmare**
   - Users must keep DevTools open to see any errors
   - No way to correlate errors with specific nodes
   - Error messages mix together from all nodes
   - Cannot copy or save error logs easily

## Proposed Solution

Create a **centralized virtual console system** that:

1. Routes all logs, errors, and warnings to the correct node's virtual console.
   - In the future, we may have a dedicated Console button that aggregates all object logs.
2. Provides rich, interactive console output (colorized, expandable objects)
3. Makes all console windows resizable
4. Enables proper text selection and scrolling
5. Works consistently across all node types

---

## Architecture

### 1. Extend Existing Logger Service

**We already have** `ui/src/lib/utils/logger.ts` with a `Logger` singleton! Instead of creating a new service, we'll **extend the existing Logger** to support:

1. **Node-scoped logging** - Associate logs with specific nodeIds
2. **Event bus integration** - Emit events for reactive UI updates
3. **Multiple arguments** - Support `console.log(a, b, c)` style logging

#### Extend Logger Interface

```typescript
// ui/src/lib/utils/logger.ts

export interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: Date;
  data?: unknown;
  nodeId?: string; // NEW: Associate logs with nodes
  args?: unknown[]; // NEW: Support multiple arguments
}

export class Logger {
  private eventBus = PatchiesEventBus.getInstance();

  // NEW: Node-scoped logging methods
  nodeLog(nodeId: string, ...args: unknown[]): void {
    this.addNodeLog(nodeId, "log", args);
  }

  nodeWarn(nodeId: string, ...args: unknown[]): void {
    this.addNodeLog(nodeId, "warn", args);
  }

  nodeError(nodeId: string, ...args: unknown[]): void {
    this.addNodeLog(nodeId, "error", args);
  }

  private addNodeLog(nodeId: string, level: LogLevel, args: unknown[]): void {
    const entry: LogEntry = {
      level,
      message: args.map((arg) => String(arg)).join(" "), // For backward compat
      timestamp: new Date(),
      nodeId,
      args, // Keep raw args for rich rendering
    };

    this.logs.push(entry);

    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }

    // Emit event for reactive UI
    this.eventBus.dispatchEvent({
      type: "consoleOutput",
      nodeId,
      messageType: level,
      timestamp: entry.timestamp.getTime(),
      args,
    });

    // Still log to DevTools for debugging
    console[level](`[${nodeId}]`, ...args);
  }

  // NEW: Get logs for a specific node
  getNodeLogs(nodeId: string): LogEntry[] {
    return this.logs.filter((log) => log.nodeId === nodeId);
  }

  // NEW: Clear logs for a specific node
  clearNodeLogs(nodeId: string): void {
    this.logs = this.logs.filter((log) => log.nodeId !== nodeId);
  }
}
```

**Key advantages:**

- Reuses existing singleton pattern
- Maintains backward compatibility with existing `logger.log()` calls
- Adds new `logger.nodeLog(nodeId, ...)` for node-scoped logging
- Already has buffer limits (1000 logs) built-in
- Already has `getLogs()`, `clearLogs()`, filtering utilities

### 2. Event Bus Integration

Add new event type to `ui/src/lib/eventbus/events.ts`:

```typescript
export interface ConsoleOutputEvent {
  type: "consoleOutput";
  nodeId: string;
  messageType: "log" | "warn" | "error" | "debug";
  timestamp: number;
  args: unknown[]; // Raw arguments for rich rendering
}

export type PatchiesEvent =
  | ConsoleOutputEvent
  | GLPreviewFrameCapturedEvent
  | PyodideConsoleOutputEvent;
// ... existing events
```

**Note:** We can eventually deprecate `PyodideConsoleOutputEvent` in favor of the generic `ConsoleOutputEvent`.

### 3. Custom Console Factory

To reduce duplication across JS-executing nodes, we provide a `createCustomConsole()` utility:

```typescript
// ui/src/lib/utils/createCustomConsole.ts

import { logger } from "$lib/utils/logger";

/**
 * Creates a custom console object that routes output to VirtualConsole via logger.
 * Used by JS-executing nodes (js, p5, tone~, etc.) to capture console.* calls.
 */
export function createCustomConsole(nodeId: string) {
  const nodeLogger = logger.ofNode(nodeId);
  return {
    log: (...args: unknown[]) => nodeLogger.log(...args),
    error: (...args: unknown[]) => nodeLogger.error(...args),
    warn: (...args: unknown[]) => nodeLogger.warn(...args),
    debug: (...args: unknown[]) => nodeLogger.debug(...args),
    info: (...args: unknown[]) => nodeLogger.info(...args),
  };
}

export type CustomConsole = ReturnType<typeof createCustomConsole>;
```

**Usage in Svelte components:**

```svelte
<script lang="ts">
  import { createCustomConsole } from '$lib/utils/createCustomConsole';

  let { id: nodeId } = $props();

  // Create once at component initialization
  const customConsole = createCustomConsole(nodeId);

  // Pass to code execution contexts
  await jsRunner.executeJavaScript(nodeId, code, { customConsole });
</script>
```

**Usage in TypeScript classes:**

```typescript
// e.g., ToneNode.ts
import { createCustomConsole } from "$lib/utils/createCustomConsole";

export class ToneNode implements AudioNodeV2 {
  private customConsole;

  constructor(nodeId: string, audioContext: AudioContext) {
    this.customConsole = createCustomConsole(nodeId);
  }

  private async setCode(code: string) {
    // Pass to user code execution
    const codeFunction = new Function("console", code);
    codeFunction(this.customConsole);
  }
}
```

**Key advantages:**

- Eliminates 7 lines of boilerplate per node
- Consistent console API across all JS-executing nodes
- Single place to extend console functionality (e.g., adding `console.table()`)
- Type-safe with exported `CustomConsole` type

### 4. Shared Console Component

Create a reusable `VirtualConsole.svelte` component that all nodes can use:

```svelte
<!-- ui/src/lib/components/VirtualConsole.svelte -->

<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { useSvelteFlow } from '@xyflow/svelte';
  import { PatchiesEventBus } from '$lib/eventbus/PatchiesEventBus';
  import type { ConsoleOutputEvent } from '$lib/eventbus/events';
  import ConsoleMessageLine from './ConsoleMessageLine.svelte';

  let {
    nodeId,
    maxHeight = '200px',
    minHeight = '100px',
    placeholder = 'Run your code to see output.',
    class: className = ''
  }: {
    nodeId: string;
    maxHeight?: string;
    minHeight?: string;
    placeholder?: string;
    class?: string;
  } = $props();

  let messages = $state<Array<{ type: string; timestamp: number; args: unknown[] }>>([]);
  let consoleContainer: HTMLDivElement | null = $state(null);
  let eventBus = PatchiesEventBus.getInstance();
  const { updateNodeData } = useSvelteFlow();

  function handleConsoleOutput(event: ConsoleOutputEvent) {
    if (event.nodeId !== nodeId) return;

    messages = [...messages, {
      type: event.messageType,
      timestamp: event.timestamp,
      args: event.args
    }];

    // Auto-show console on first error or warning
    if (event.messageType === 'error' || event.messageType === 'warn') {
      updateNodeData(nodeId, { showConsole: true });
    }

    // Auto-scroll to bottom
    setTimeout(() => {
      consoleContainer?.scrollTo({
        top: consoleContainer.scrollHeight,
        behavior: 'smooth'
      });
    }, 10);
  }

  export function clearConsole() {
    messages = [];
  }

  onMount(() => {
    eventBus.addEventListener('consoleOutput', handleConsoleOutput);
  });

  onDestroy(() => {
    eventBus.removeEventListener('consoleOutput', handleConsoleOutput);
  });
</script>

<div
  bind:this={consoleContainer}
  class={[
    'nodrag cursor-text overflow-y-auto rounded border border-zinc-700 bg-zinc-800 p-2 font-mono text-xs resize-y',
    className
  ]}
  style="min-height: {minHeight}; max-height: {maxHeight};"
>
  {#if messages.length === 0}
    <div class="text-zinc-500 italic">{placeholder}</div>
  {:else}
    {#each messages as msg, i}
      <ConsoleMessageLine {msg} />
    {/each}
  {/if}
</div>
```

**Key features:**

- Auto-shows console on first error/warning via `updateNodeData`
- Exports `clearConsole()` for parent components to clear on re-run
- Auto-scrolls to bottom when new messages arrive
- Resizable via CSS `resize: vertical`

### 5. Rich Console Message Renderer

Create `ConsoleMessageLine.svelte` for rich output:

```svelte
<!-- ui/src/lib/components/ConsoleMessageLine.svelte -->

<script lang="ts">
  let {
    msg
  }: {
    msg: { type: string; args: unknown[] }
  } = $props();

  const typeColors = {
    log: 'text-zinc-100',
    warn: 'text-amber-300',
    error: 'text-red-400'
  };

  const typeClass = $derived(typeColors[msg.type as keyof typeof typeColors] || 'text-zinc-100');
</script>

<div class={['mb-1 whitespace-pre-wrap select-text', typeClass]}>
  {#if msg.type === 'error'}
    <span class="font-bold">ERROR: </span>
  {:else if msg.type === 'warn'}
    <span class="font-bold">WARN: </span>
  {/if}

  {#each msg.args as arg, i}
    {#if i > 0}<span class="opacity-50"> </span>{/if}
    <ConsoleValue value={arg} />
  {/each}
</div>
```

Create `ConsoleValue.svelte` for rendering different value types:

```svelte
<!-- ui/src/lib/components/ConsoleValue.svelte -->

<script lang="ts">
  let {
    value,
    depth = 0
  }: {
    value: unknown;
    depth?: number;
  } = $props();

  let expanded = $state(false);

  const maxDepth = 3;

  function renderValue(val: unknown): string {
    if (val === null) return 'null';
    if (val === undefined) return 'undefined';

    const type = typeof val;

    if (type === 'string') return `"${val}"`;
    if (type === 'number' || type === 'boolean') return String(val);

    return '';
  }

  const isExpandable = $derived(
    value !== null &&
    value !== undefined &&
    typeof value === 'object' &&
    depth < maxDepth
  );
</script>

{#if !isExpandable}
  <span>{renderValue(value)}</span>
{:else}
  <span>
    <button
      class="hover:bg-zinc-700 px-1 rounded"
      onclick={() => expanded = !expanded}
    >
      {expanded ? '▼' : '▶'}
    </button>

    {#if Array.isArray(value)}
      <span class="text-zinc-400">Array({value.length})</span>
    {:else}
      <span class="text-zinc-400">Object</span>
    {/if}

    {#if expanded}
      <div class="ml-4 border-l border-zinc-600 pl-2">
        {#if Array.isArray(value)}
          {#each value as item, i}
            <div>
              <span class="text-zinc-500">{i}:</span>
              <ConsoleValue value={item} depth={depth + 1} />
            </div>
          {/each}
        {:else}
          {#each Object.entries(value) as [key, val]}
            <div>
              <span class="text-emerald-400">{key}:</span>
              <ConsoleValue value={val} depth={depth + 1} />
            </div>
          {/each}
        {/if}
      </div>
    {/if}
  </span>
{/if}
```

---

## Integration Strategy

### Phase 1: Migrate Existing Consoles

#### 1.1 Update JSBlockNode

Replace custom console implementation with `VirtualConsole.svelte`:

```svelte
<script lang="ts">
  import VirtualConsole from '$lib/components/VirtualConsole.svelte';

  let consoleRef: VirtualConsole | null = null;

  async function executeCode() {
    // Clear console on re-run
    consoleRef?.clearConsole();

    // ... execute code
  }
</script>

{#if data.showConsole}
  <VirtualConsole bind:this={consoleRef} {nodeId} maxHeight="200px" />
{/if}
```

Update `JSRunner` to use `logger` instead of custom console:

```typescript
// ui/src/lib/js-runner/JSRunner.ts

import { logger } from "$lib/utils/logger";

const customConsole = {
  log: (...args: unknown[]) => logger.nodeLog(nodeId, ...args),
  error: (...args: unknown[]) => logger.nodeError(nodeId, ...args),
  warn: (...args: unknown[]) => logger.nodeWarn(nodeId, ...args),
};
```

#### 1.2 Update PythonNode

Similar migration - replace event listening with `VirtualConsole.svelte`.

### Phase 2: Add Consoles to Visual Nodes

#### 2.1 P5CanvasNode

Add optional console toggle (like `js` node):

```svelte
<ObjectPreviewLayout
  title={data.title ?? 'p5'}
  onrun={updateSketch}
  showConsoleToggle={true}
  consoleNodeId={nodeId}
>
  {#snippet console()}
    <VirtualConsole {nodeId} placeholder="P5.js errors will appear here." />
  {/snippet}

  <!-- existing snippets -->
</ObjectPreviewLayout>
```

Update `P5Manager` to catch and log errors:

```typescript
// ui/src/lib/p5/P5Manager.ts

import { logger } from "$lib/utils/logger";

p.draw = function () {
  try {
    userCode?.draw?.call(p);
    sendBitmap();
  } catch (error) {
    logger.nodeError(nodeId, error);
    p.background(220, 100, 100);
    p.fill(255);
    throw error; // Still throw for debugging
  }
};
```

#### 2.2 GLSLCanvasNode

Add shader compilation error display:

```svelte
<CanvasPreviewLayout
  title={data.title ?? 'glsl'}
  onrun={updateShader}
  showConsoleToggle={true}
  consoleNodeId={nodeId}
>
  {#snippet console()}
    <VirtualConsole {nodeId} placeholder="Shader errors will appear here." />
  {/snippet}
</CanvasPreviewLayout>
```

Update `GLSystem` to emit shader errors:

```typescript
// ui/src/lib/canvas/GLSystem.ts

import { logger } from '$lib/utils/logger';

private compileShader(nodeId: string, ...): void {
  try {
    // ... shader compilation
  } catch (error) {
    logger.nodeError(nodeId, 'Shader compilation failed:', error);
    throw error;
  }
}
```

### Phase 3: Audio Nodes

#### 3.1 Audio V2 Nodes (dsp~, tone~, elem~, sonic~)

Add console to `SimpleDspLayout.svelte`:

```svelte
<!-- ui/src/lib/components/nodes/SimpleDspLayout.svelte -->

<div class="flex flex-col gap-2">
  <!-- existing code editor -->

  {#if showConsole}
    <VirtualConsole {nodeId} maxHeight="150px" placeholder="Audio errors appear here." />
  {/if}
</div>
```

Update audio node classes to use `logger`:

```typescript
// ui/src/lib/audio/v2/nodes/DspNode.ts

import { logger } from "$lib/utils/logger";

export class DspNode implements AudioNodeV2 {
  async send(message: string, data: unknown): Promise<void> {
    if (message === "code") {
      try {
        // ... compile DSP code
      } catch (error) {
        logger.nodeError(this.id, "DSP compilation failed:", error);
      }
    }
  }
}
```

---

## Resizable Console Windows

Add CSS for resizable consoles using native `resize` property:

```css
/* Already in VirtualConsole.svelte */
.console-container {
  resize: vertical;
  overflow: auto;
  min-height: var(--min-height, 100px);
  max-height: var(--max-height, 400px);
}
```

Users can drag the bottom-right corner to resize. The `nodrag` class prevents XYFlow from capturing drag events.

---

## Implementation Checklist

### Core Infrastructure

- [x] Extend `Logger` class in `ui/src/lib/utils/logger.ts`
  - [x] Add `nodeId?: string` and `args?: unknown[]` to `LogEntry`
  - [x] Add `nodeLog()`, `nodeWarn()`, `nodeError()` methods
  - [x] Add event bus integration
  - [x] Add `getNodeLogs()`, `clearNodeLogs()` methods
- [x] Add `ConsoleOutputEvent` to `ui/src/lib/eventbus/events.ts`
- [x] Create `VirtualConsole.svelte` component
- [x] Create `ConsoleMessageLine.svelte` for message rendering
- [x] Create `ConsoleValue.svelte` for rich value display (expandable objects/arrays)
- [x] Create `createCustomConsole()` utility for shared console creation

### Migrate Existing Consoles

- [x] Update `JSBlockNode.svelte` to use `VirtualConsole`
- [x] Update `JSRunner.ts` to use `logger`
- [x] Add JS syntax error line highlighting with `parseJSError()` utility
- [x] Update `MessageSystem.ts` to route `recv()` callback errors to VirtualConsole
- [ ] Update `PythonNode.svelte` to use `VirtualConsole`
- [ ] Migrate `PyodideSystem` to use `logger` (deprecate custom event)

### Add Consoles to Visual Nodes

- [x] Add console to `P5CanvasNode.svelte`
- [x] Update `P5Manager.ts` to log errors via `logger`
- [x] Add P5 syntax error line highlighting (reuses `parseJSError()` utility)
- [x] Add console to `GLSLCanvasNode.svelte`
- [x] Update `GLSystem.ts` to log shader errors via `logger`
- [ ] Add console to `HydraNode.svelte`
- [ ] Add console to `SwissGLNode.svelte`
- [ ] Add console to `JSCanvasNode.svelte`
- [ ] Add console to `CanvasDom.svelte`

### Add Consoles to Audio Nodes

- [x] Add console to `SimpleDspLayout.svelte` (shared by dsp~, tone~, elem~, sonic~)
- [ ] Update `DspNode.ts` to use `logger`
- [x] Update `ToneNode.ts` to use `logger`
- [ ] Update `ElementaryNode.ts` to use `logger`
- [ ] Update `SonicNode.ts` to use `logger`

### Testing & Polish

- [ ] Test text selection across multiple console lines
- [ ] Test scrolling behavior
- [ ] Test resizing console windows
- [ ] Test expandable JSON objects
- [x] Test error colorization
- [x] Ensure console clears when node is re-run
- [ ] Test performance with many log messages (>1000 lines)

---

## Design Decisions

### 1. Console Visibility

**Decision:** Hidden by default, **auto-show on first error**

- Consoles start hidden to reduce visual clutter
- When a node logs its first error/warning, console automatically becomes visible
- Users can manually toggle visibility with Terminal button
- Console persists visibility state in node data

### 2. Console Positioning

**Visual nodes (p5, glsl, hydra, swissgl, canvas, etc.):**

- Console appears **below the preview canvas**
- Keeps code editor and preview together visually

**Audio/code nodes (js, python, dsp~, tone~, elem~, sonic~):**

- Console appears **below the code editor**
- Avoids overlap with code editor
- Only one floating action button needed (for editor toggle)

**Layout examples:**

```txt
Visual node:               Code/Audio node:
┌─────────────┐           ┌─────────────┐
│   Preview   │           │ Code Editor │
│   Canvas    │           │             │
└─────────────┘           └─────────────┘
┌─────────────┐           ┌─────────────┐
│   Console   │ (hidden)  │   Console   │ (hidden)
└─────────────┘           └─────────────┘
```

### 3. Console Scope

**Decision:** Per-node consoles only (no global console)

- Each node has its own isolated console
- Easier to correlate errors with specific nodes
- Future enhancement: Could add dedicated "Console" node that aggregates all logs

### 4. Console Mode

**Decision:** Output-only (no REPL mode)

- Focus on logging, warnings, and errors
- No input or command execution
- Keeps implementation simpler
- Future enhancement: REPL mode could be added later

### 5. Auto-clear Behavior

**Decision:** Clear console when re-running code

- Fresh output on each run
- Prevents confusion from stale logs
- Matches mental model of "run → see results"
- User can still review logs in DevTools if needed

### 6. Console Buffer Limits

**Decision:** Limit to 1000 messages (already built into Logger)

- Prevents performance issues with excessive logging
- FIFO eviction (oldest messages dropped first)
- Future enhancement: Virtual scrolling if needed

### 7. Console Persistence

**Decision:** Don't persist console output in saved patches

- Console is transient debugging output
- Reduces patch file size
- Matches DevTools behavior

---

## Future Enhancements

1. **Search/Filter**

   - Search within console output
   - Filter by message type (log/warn/error)

2. **Export Logs**

   - Copy all logs to clipboard
   - Download logs as .txt file

3. **Timestamps**

   - Optional timestamp display
   - Relative timestamps (e.g., "2s ago")

4. **Log Levels**

   - Support `console.debug()`, `console.info()`, etc.
   - Filterable log levels

5. **Performance Monitoring**

   - Show execution time for code runs
   - Memory usage (if accessible)

6. **Stack Traces**

   - Click to jump to error location in code editor
   - Syntax highlighting for stack traces

7. **Autocomplete History**
   - REPL mode with command history
   - Up/down arrows to navigate history

---

## Performance Considerations

1. **Event Bus Overhead**

   - Each console message creates an event
   - For high-frequency logging (e.g., in draw loop), consider batching

2. **DOM Updates**

   - Use Svelte's reactivity efficiently
   - Consider virtual scrolling for large message lists

3. **Memory Leaks**
   - Ensure event listeners are cleaned up in `onDestroy`
   - Clear message buffers when nodes are deleted

---

## Accessibility

1. **Screen Readers**

   - Console messages should be announced
   - Use `role="log"` and `aria-live="polite"`

2. **Keyboard Navigation**

   - Tab through console controls (clear, expand, etc.)
   - Keyboard shortcuts for common actions

3. **Text Selection**
   - Full text selection support
   - Copy-paste should work naturally

---

## Migration Impact

### Breaking Changes

None - this is purely additive functionality.

### Deprecations

- Old `pyodideConsoleOutput` event will be replaced by generic `consoleOutput`
- Can keep old event for backward compatibility during transition

### User-Facing Changes

- Console windows become resizable
- JSON objects become expandable/interactive
- Better error visibility for all nodes

---

## Success Metrics

1. **Error Visibility:** Users can debug errors without opening DevTools
2. **Text Selection:** Users can select and copy console text naturally
3. **Performance:** Console handles 1000+ messages without lag
4. **Adoption:** All node types support virtual console
5. **UX:** Console scrolling, resizing, and clearing work intuitively

---

## Related Specs

- [3-js-block.md](./3-js-block.md) - Original JS block spec
- [24-pyodide.md](./24-pyodide.md) - Python node with console
- [29-audio-expr-dsp-object.md](./29-audio-expr-dsp-object.md) - DSP audio nodes

---

## Questions for Discussion

1. Should we support **REPL mode** (input + output) in addition to output-only console?
2. Should consoles be **dockable** (can be dragged out of the node)?
3. Should we add **console.table()** support for tabular data?
4. Should errors in **setup()** vs **draw()** be handled differently?
5. Should we capture **P5.js internal errors** (e.g., WebGL context loss)?
6. For audio nodes, should we log **audio graph connections** (helpful for debugging)?
