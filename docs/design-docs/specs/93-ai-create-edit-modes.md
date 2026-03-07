# 93. AI Create and Edit Modes

## Overview

Extend the AI object prompt system with new create and edit modes, and refactor `AiObjectPrompt.svelte` + supporting code into a maintainable, mode-driven architecture so adding new modes requires minimal effort.

Current state: 609-line `AiObjectPrompt.svelte` with hard-coded branching for 3 modes (`single`, `multi`, `edit`). Each new mode would add ~50–100 more lines of tangled conditionals.

---

## New Modes

### Edit / Replace Modes

**`replace`** — Turn object X into Y (change type + data)

- Trigger: user right-clicks a node → "AI Replace..." or opens AI prompt while a node is selected with the replace toggle active
- Context: current node type, current node data
- AI flow: route to new type (like single-object router) → generate config for new type
- Result: `onReplaceObject(nodeId, newType, newData)` — canvas deletes old node, inserts new node at same position, attempts to preserve connected edges
- UX: pre-fills prompt with "Replace this [type] with..."
- Color: amber (same as edit)

**`fix-error`** — Fix error from virtual console

- Trigger: dedicated "Fix with AI" button on a node's error badge / console panel
- Context: node type, node data (code), error message(s) from virtual console
- AI flow: same as `edit` — single call with enhanced prompt that includes the error
- The error message is injected into the system prompt; the user's text prompt is optional ("fix this", or blank → AI infers)
- Result: `onEditObject(nodeId, updatedData)` — same callback as regular edit
- UX: error text is displayed read-only in the dialog body; textarea is for optional additional instructions
- Color: red

### Single Create Modes

**`create-from-sender`** — Create a consumer from a selected sender

- Trigger: right-click a `send`, `send~`, or `send.vdo` node → "AI Create Receiver"
- Context: sender node type and `name` field
- AI flow: deterministic for simple cases (just mirror name → matching recv type); AI is used when the user adds a prompt like "and visualize it as a bar chart" → generates a full `js`/`p5` node that calls `recv(name, ...)`
- If prompt is blank: skip AI entirely — directly create matching receiver with same name
- Result: `onInsertObject(type, data)` — canvas places the receiver near the sender and auto-connects
- Color: green

**`create-from-consumer`** — Create a sender from a selected consumer

- Same as above but inverted: right-click a `recv`, `recv~`, `recv.vdo` → "AI Create Sender"
- Same deterministic + optional AI pattern
- Color: green

### Multiple Create Modes

**`decompose`** — Split one object into 2+ connected objects

- Trigger: right-click a large/complex node (p5, js, canvas.dom, worker...) → "AI Decompose"
- Context: node type, full node data (code)
- User prompt: describes the desired split ("separate drawing and data logic", "extract the FFT analysis")
- AI flow: single call — given the current code + prompt, return a `MultiObjectResult` (same `{ nodes, edges }` structure as multi-mode)
- Result: `onInsertMultipleObjects(nodes, edges)` — canvas places decomposed nodes and wires them; optionally deletes the original (user confirms)
- Color: blue (same as multi)

---

## Architecture Refactor

### Problem

`AiObjectPrompt.svelte` mixes UI rendering, mode state, drag logic, submission logic, and AI dispatch in one file. Adding each new mode requires touching the component directly.

### Solution: Mode Descriptors + AiPromptController

**1. Mode descriptor interface** (`src/lib/ai/modes/types.ts`)

Each mode is a self-contained descriptor. Adding a new mode = adding a new descriptor file.

```typescript
import type {Component} from 'svelte'
import type {Node} from '@xyflow/svelte'

export type AiPromptColor = 'purple' | 'blue' | 'amber' | 'green' | 'red'

export interface AiModeContext {
  selectedNode?: Node // The node being edited/replaced/decomposed
  consoleErrors?: string[] // Error messages for fix-error mode
}

export interface AiModeDescriptor {
  id: AiPromptMode
  label: string
  description: (ctx: AiModeContext) => string
  placeholder: (ctx: AiModeContext) => string
  color: AiPromptColor
  icon: Component
  /** Whether this mode creates multiple objects */
  isMulti: boolean
  /** Whether this mode requires a selected node */
  requiresNode: boolean
  /** Whether the prompt textarea is optional (e.g. fix-error, create-from-sender) */
  promptOptional?: boolean
}
```

**2. Extend AiPromptMode type** (`src/stores/ai-prompt.store.ts`)

```typescript
export type AiPromptMode =
  | 'single' // Create one object
  | 'multi' // Create multiple objects
  | 'edit' // Edit existing object data
  | 'replace' // Replace object type + data
  | 'fix-error' // Fix code error using console output
  | 'create-from-sender' // Create consumer from sender node
  | 'create-from-consumer' // Create sender from consumer node
  | 'decompose' // Split object into multiple
```

**3. AiPromptController composable** (`src/lib/ai/ai-prompt-controller.svelte.ts`)

Extracts all stateful logic out of the component. Returns a reactive object the component binds to.

```typescript
export function createAiPromptController(opts: {
  getPosition: () => {x: number; y: number}
  onInsertObject: (type: string, data: Record<string, unknown>) => void
  onInsertMultipleObjects: (
    nodes: AiObjectNode[],
    edges: SimplifiedEdge[],
  ) => void
  onEditObject: (nodeId: string, data: Record<string, unknown>) => void
  onReplaceObject: (
    nodeId: string,
    newType: string,
    newData: Record<string, unknown>,
  ) => void
}) {
  // All $state variables live here
  let mode = $state<AiPromptMode>('single')
  let isLoading = $state(false)
  let promptText = $state('')
  let errorMessage = $state<string | null>(null)
  let thinkingLog = $state<string[]>([])
  // ...

  async function submit() {
    // Dispatches to the right resolver based on mode
    const descriptor = getModeDescriptor(mode)
    const resolver = getModeResolver(mode)
    // ...
  }

  return {
    // Reactive state
    get mode() {
      return mode
    },
    get isLoading() {
      return isLoading
    },
    // ...
    // Actions
    setMode,
    submit,
    cancel,
    close,
  }
}
```

**4. Mode resolvers** (`src/lib/ai/modes/`)

Each mode gets its own resolver file. The resolver is a pure async function:

```
src/lib/ai/modes/
  types.ts               — interfaces
  descriptors.ts         — all AiModeDescriptor objects
  replace-resolver.ts
  fix-error-resolver.ts
  create-from-sender-resolver.ts
  create-from-consumer-resolver.ts
  decompose-resolver.ts
```

Resolver signature:

```typescript
type ModeResolver = (
  prompt: string,
  context: AiModeContext,
  signal: AbortSignal,
  onThinking: (thought: string) => void,
  onProgress?: (status: string) => void,
) => Promise<AiModeResult>

type AiModeResult =
  | {kind: 'single'; type: string; data: Record<string, unknown>}
  | {kind: 'multi'; nodes: AiObjectNode[]; edges: SimplifiedEdge[]}
  | {kind: 'edit'; nodeId: string; data: Record<string, unknown>}
  | {
      kind: 'replace'
      nodeId: string
      newType: string
      newData: Record<string, unknown>
    }
```

**5. Thin component**

After refactor, `AiObjectPrompt.svelte` becomes ~200 lines:

- Imports controller + mode descriptors
- Renders header icon/title/description from `descriptor`
- Renders input area (textarea or error display based on descriptor flags)
- Renders footer status text + action buttons
- No branching on specific modes — all driven by the active descriptor

---

## Canvas Callback Extensions

`AiObjectPrompt` needs two new callbacks:

```typescript
// Existing
onInsertObject: (type: string, data: Record<string, unknown>) => void;
onInsertMultipleObjects?: (nodes: AiObjectNode[], edges: SimplifiedEdge[]) => void;
onEditObject?: (nodeId: string, data: Record<string, unknown>) => void;

// New
onReplaceObject?: (nodeId: string, newType: string, newData: Record<string, unknown>) => void;
// onInsertMultipleObjects reused for decompose
```

The canvas handler for `onReplaceObject`:

1. Record current node position and connected edges
2. Delete the old node
3. Insert new node at same position
4. Re-connect edges whose handle IDs still exist on the new type (best-effort)

---

## Mode Entry Points

Modes are triggered from multiple places — not just the toolbar AI button:

| Mode                   | Trigger                                              |
| ---------------------- | ---------------------------------------------------- |
| `single`               | Toolbar AI button, canvas double-click, palette      |
| `multi`                | Toolbar toggle (Ctrl+I), or Single/Multi button      |
| `edit`                 | Node context menu → "AI Edit"                        |
| `replace`              | Node context menu → "AI Replace..."                  |
| `fix-error`            | Error badge on node → "Fix with AI"                  |
| `create-from-sender`   | Node context menu on send/send~/send.vdo             |
| `create-from-consumer` | Node context menu on recv/recv~/recv.vdo             |
| `decompose`            | Node context menu on complex nodes (js, p5, canvas…) |

---

## Resolver Implementation Notes

### `replace`

- Call 1: router prompt (same as single-object router) → new type
- Call 2: generator prompt with new type + context of old node
- The old node's code/data is injected as context: "Replacing a [oldType] that had: [data summary]"

### `fix-error`

- Single call (no routing needed — type is known)
- System prompt includes: node type, existing code, error messages
- User prompt injected as additional instructions (may be empty)
- Reuses `editObjectFromPrompt` internally with enriched `existingData`

### `create-from-sender` / `create-from-consumer`

- If prompt is blank: skip AI, deterministically create matching pair
  - `send name` → `recv name`, `send~ name` → `recv~ name`, etc.
- If prompt is non-blank: call AI with context of the sender's name + type, generate a consumer that uses `recv(name, ...)` or audio connection
- No routing needed — type is determined by pairing rules

### `decompose`

- Single call that returns multi-object JSON (same schema as multi-mode)
- System prompt: "You are decomposing an existing [type] object. Current code: [code]. Split it into multiple focused objects connected by edges."
- Result validated same as `resolveMultipleObjectsFromPrompt`

---

## Implementation Plan

1. **Define types** — `AiPromptMode` union, `AiModeDescriptor`, `AiModeContext`, `AiModeResult` in `src/lib/ai/modes/types.ts`
2. **Write mode descriptors** — all 8 modes in `src/lib/ai/modes/descriptors.ts`
3. **Write resolvers** — one file per new mode (`replace`, `fix-error`, `create-from-sender`, `create-from-consumer`, `decompose`)
4. **Extract `AiPromptController`** — move all `$state` + submit logic from component into `ai-prompt-controller.svelte.ts`
5. **Refactor `AiObjectPrompt.svelte`** — wire to controller, drive UI from active descriptor
6. **Add canvas callbacks** — `onReplaceObject` in canvas component and `handle-ai-*.ts` files
7. **Add context menu entries** — per mode entry points in node context menus
8. **Add `fix-error` trigger** — "Fix with AI" button on node error badge

Steps 1–4 can be done in parallel with step 5. Steps 6–8 are sequential after 5.
