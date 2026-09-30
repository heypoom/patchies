# 94. AI Create and Edit Modes

## Overview

Extend the AI object prompt system with new create and edit modes, and refactor `AiObjectPrompt.svelte` + supporting code into a maintainable, mode-driven architecture so adding new modes requires minimal effort.

~~Current state: 609-line `AiObjectPrompt.svelte` with hard-coded branching for 3 modes (`single`, `multi`, `edit`). Each new mode would add ~50–100 more lines of tangled conditionals.~~

**Done:** `AiObjectPrompt.svelte` is now ~450 lines, fully mode-driven, backed by `AiPromptController`. All 8 modes are implemented.

---

## Modes

### Edit / Replace Modes

**`replace`** ✅ — Turn object X into Y (change type + data)

- Context: current node type, current node data
- AI flow: route to new type → generate config for new type
- Result: `onReplaceObject(nodeId, newType, newData)` — canvas deletes old node, inserts new at same position, preserves connected edges
- Color: amber (same as edit)

**`fix-error`** ✅ — Fix error from virtual console

- Context: node type, node data (code), error messages from virtual console
- The error messages are injected into the system prompt; user text prompt is optional
- Result: `onEditObject(nodeId, updatedData)` — same callback as regular edit
- Color: red

### Single Create Modes

**`create-consumer`** ✅ — Create a consumer for a selected producer node

- Works with ANY producer node (p5, js, canvas, osc~, sort visualizers, etc.)
- Injects producer node's type, name, and code as context for the AI
- User prompt is optional ("visualize as a bar chart")
- Result: `onInsertObject(type, data)`
- Color: green

**`create-producer`** ✅ — Create a producer for a selected consumer node

- Works with ANY consumer node (recv, js, p5, canvas, etc.)
- Injects consumer node's type, name, and code as context for the AI
- User prompt is optional ("send a sine wave")
- Result: `onInsertObject(type, data)`
- Color: green

> **Note:** Originally specced as `create-from-sender`/`create-from-consumer` with send~/recv~-only deterministic pairing. Redesigned to be AI-driven and work with ANY node type.

### Multiple Create Modes

**`decompose`** ✅ — Split one object into 2+ connected objects

- Context: node type, full node data (code)
- User prompt: describes the desired split
- AI flow: single call returning `{ nodes, edges }` (same schema as multi-mode)
- Result: `onInsertMultipleObjects(nodes, edges)`
- Color: blue

---

## Architecture

### Files

```text
src/lib/ai/modes/
  types.ts                  — AiPromptMode, AiModeDescriptor, AiModeContext, AiModeResult, ModeResolver
  descriptors.ts            — all 8 AiModeDescriptor objects + getAvailableModesForContext()
  replace-resolver.ts
  fix-error-resolver.ts
  create-consumer-resolver.ts
  create-producer-resolver.ts
  decompose-resolver.ts

src/lib/ai/
  ai-prompt-controller.svelte.ts   — createAiPromptController() factory

src/lib/components/
  AiObjectPrompt.svelte            — thin UI component, driven by descriptor
```

### AiPromptMode type

```typescript
export type AiPromptMode =
  | "single" // Create one object
  | "multi" // Create multiple connected objects
  | "edit" // Edit existing object data
  | "replace" // Replace object type + data
  | "fix-error" // Fix code error using console output
  | "create-consumer" // Create a consumer for the selected producer node
  | "create-producer" // Create a producer for the selected consumer node
  | "decompose"; // Split object into multiple
```

### Mode selector UX

- Header shows a single dropdown button (current mode shortLabel + chevron)
- Clicking opens a popover list of available modes for the current context
- **Ctrl+I** cycles through available modes in order
- Available modes:
  - No node selected → `[single, multi]`
  - Node selected → `[edit, replace, fix-error, decompose, create-consumer, create-producer]`

### AiModeDescriptor

```typescript
export interface AiModeDescriptor {
  id: AiPromptMode;
  label: string;
  shortLabel: string; // used in dropdown button + mode list
  description: (ctx: AiModeContext) => string;
  placeholder: (ctx: AiModeContext) => string;
  color: AiPromptColor;
  icon: Component;
  isMulti: boolean;
  requiresNode: boolean;
  promptOptional?: boolean;
  loadingLabel: string; // e.g. "Deciding", "Editing", "Fixing"
  generatingLabel: (resolvedType: string) => string; // e.g. "Cooking p5", "Replacing with p5"
  availableInChat?: boolean; // for spec 95 chat tool integration
  chatToolDescription?: string;
  chatToolSchema?: object;
}
```

### ModeResolver signature

```typescript
type ModeResolver = (
  prompt: string,
  context: AiModeContext,
  signal: AbortSignal,
  onThinking: (thought: string) => void,
  onProgress?: (status: string) => void,
) => Promise<AiModeResult>;
```

### Canvas callbacks

```typescript
onInsertObject: (type: string, data: Record<string, unknown>) => void;
onInsertMultipleObjects?: (nodes: AiObjectNode[], edges: SimplifiedEdge[]) => void;
onEditObject?: (nodeId: string, data: Record<string, unknown>) => void;
onReplaceObject?: (nodeId: string, newType: string, newData: Record<string, unknown>) => void;
```

`AiOperationsService.replaceNode()` handles: captures position + connected edges → deletes old node → inserts new at same position → re-adds edges with updated source/target IDs.

---

## Mode Entry Points

- `single` — Toolbar AI button, canvas double-click, palette. **Done.**
- `multi` — Mode dropdown / Ctrl+I. **Done.**
- `edit` — Mode dropdown (node selected) / context menu. Dropdown done; context menu TODO.
- `replace` — Mode dropdown (node selected) / context menu. Dropdown done; context menu TODO.
- `fix-error` — Mode dropdown (node selected). **Done.** Error badge → "Fix with AI" shortcut: **TODO.**
- `create-consumer` — Mode dropdown (node selected) / context menu. Dropdown done; context menu TODO.
- `create-producer` — Mode dropdown (node selected) / context menu. Dropdown done; context menu TODO.
- `decompose` — Mode dropdown (node selected) / context menu. Dropdown done; context menu TODO.

---

## Remaining Work

### Step 7 — Context menu entries

Add AI mode entries to node right-click context menus. When selected, open `AiObjectPrompt` with the correct mode + context pre-set.

Suggested entries:

- All nodes: **AI Edit**, **AI Replace**, **AI Decompose**, **AI Create Consumer**, **AI Create Producer**
- Error nodes only: **Fix with AI** (or surface via the error badge instead)

### Step 8 — "Fix with AI" trigger on error badge

Add a button on the node error badge (or virtual console panel) that opens the AI prompt in `fix-error` mode with the node's current console errors pre-loaded into `context.consoleErrors`.

## Streaming reasoning display

Reasoning callbacks deliver text deltas. AI Edit, Preview Edit, and Patch to Prompt concatenate them without adding whitespace, rendering one block per provider generation. Providers announce generation boundaries so routing and configuration generation remain separate blocks. Compact previews show the accumulated current block.

OpenRouter displays readable text and summary reasoning, using only one representation when plaintext and structured fields overlap. Encrypted reasoning stays hidden. Only encrypted-only generations show “Reasoning is encrypted and cannot be displayed.” Emit this notice after the stream finishes so readable reasoning arriving later suppresses it.

## Failed generation recovery

- Keep failures visible inside `AiObjectPrompt`; do not send failure messages only to a toast.
- Restore the dialog after a failed request with the submitted prompt in the editable textarea. Retrying clears the previous error and response.
- Preserve the model's original response when parsing or validating its object configuration fails. Show it as plain text in a bounded scroll area, including prose replies and malformed JSON.
- Recover literal control characters inside JSON strings by escaping them without changing their decoded content. Continue rejecting other malformed JSON; do not guess missing code or fields.
- Initialize controller state only when the dialog opens. Mode changes and layout updates must not erase a draft or failure.
- Keep successful application and cancellation behavior unchanged.

### Explanations after JSON

- For responses starting with a JSON object (plain or fenced), find the matching closing brace while respecting nested containers, quoted strings, and escaped quotes. Parse only that JSON segment.
- Keep trailing text separate from object data and carry it through mode results to the prompt controller. Multi-object results include explanations from both routing and generation.
- After applying a successful result with an explanation, restore the dialog and show the explanation as Markdown in a bounded scroll area. Keep the prompt editable and offer a Done button to dismiss the result. Success without an explanation continues to close the dialog.
- Incomplete or malformed JSON still shows the original response as a failure; never search past a malformed leading object for another usable object.
