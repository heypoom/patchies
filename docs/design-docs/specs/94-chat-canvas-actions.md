# 94. Chat Canvas Actions

## Overview

Extend ChatView with the ability to perform canvas mutations (create, edit, replace, decompose, etc.) via tool calls, while sharing all resolver logic with `AiObjectPrompt`. The floating `AiObjectPrompt` dialog is unchanged — it remains the fast "quick edit" path. ChatView becomes the conversational path to the same underlying operations.

---

## Mental Model

|                | AiObjectPrompt           | ChatView                               |
| -------------- | ------------------------ | -------------------------------------- |
| UX pattern     | Quick command palette    | Conversational assistant               |
| Apply behavior | Auto-apply (optimistic)  | Explicit confirm via ActionCard        |
| Context        | Explicitly selected node | Node context at time of tool call      |
| Output         | Directly mutates canvas  | Prose + optional ActionCards in thread |

---

## Architecture

```
ChatView                      AiObjectPrompt
chat/resolver.ts              ai-prompt-controller.svelte.ts
      ↓                              ↓
      └───────────────┬──────────────┘
                      ↓
              src/lib/ai/modes/
         resolvers + descriptors (spec 93)
                      ↓
              Canvas callbacks
```

No resolver duplication. The mode system from spec 93 (`AiModeDescriptor`, `AiModeResult`, resolver files) is the shared foundation. ChatView consumes it via tool definitions; AiObjectPrompt consumes it via `AiPromptController`.

---

## Chat Tool Definitions

The chat system prompt is extended with tool definitions auto-derived from the mode descriptor registry. Each mode that makes sense in a conversational context gets a tool:

```typescript
// src/lib/ai/chat/canvas-tools.ts

export function buildCanvasToolDefinitions(
  descriptors: AiModeDescriptor[],
): ToolDefinition[] {
  return descriptors
    .filter((d) => d.availableInChat) // opt-in per descriptor
    .map((d) => ({
      name: d.id, // e.g. "edit", "create", "replace"
      description: d.chatToolDescription,
      inputSchema: d.chatToolSchema, // JSON Schema for the tool input
    }))
}
```

### Tool inputs (examples)

| Tool        | Input                                                   |
| ----------- | ------------------------------------------------------- |
| `single`    | `{ prompt: string }`                                    |
| `multi`     | `{ prompt: string }`                                    |
| `edit`      | `{ nodeId: string, prompt: string }`                    |
| `replace`   | `{ nodeId: string, prompt: string }`                    |
| `fix-error` | `{ nodeId: string, errors: string[], prompt?: string }` |
| `decompose` | `{ nodeId: string, prompt: string }`                    |

---

## ActionCard Component

When the chat AI returns a tool call, an `ActionCard.svelte` is rendered inline in the message thread.

```
Claude: I'll update the oscillator frequency for you.
┌─────────────────────────────────────────────────────┐
│ ✏️  Edit: osc-1                                      │
│                                                     │
│  frequency: 200 → 440                               │
│  detune: 0 (unchanged)                              │
│                                                     │
│  [Apply]                              [Dismiss]     │
└─────────────────────────────────────────────────────┘
```

States:

- **Pending**: Apply / Dismiss buttons shown. The resolver has already run and produced an `AiModeResult` — no extra latency on confirm.
- **Applied**: Green check, "Applied" label, no buttons. Thread remains readable.
- **Dismissed**: Dimmed, "Dismissed" label.
- **Loading**: Spinner while resolver runs (before ActionCard is shown).

ActionCard uses the mode descriptor's `color` and `icon` for visual styling — same as AiObjectPrompt.

---

## Execution Flow

```
1. User sends message in ChatView
2. chat/resolver.ts streams response
3a. Text chunk → append to assistant bubble (existing behavior)
3b. Tool call → run the mode resolver immediately
     - Shows "running tool..." indicator in stream
     - Resolver produces AiModeResult
4. AiModeResult → render ActionCard in thread (pending state)
5. User clicks Apply
     → call canvas callback (onInsertObject / onEditObject / etc.)
     → ActionCard transitions to applied state
     → chat continues (AI can see the tool result and respond)
6. User clicks Dismiss
     → ActionCard dims
     → chat continues (AI sees the tool was dismissed)
```

Resolvers run eagerly when the tool call arrives — not on confirm. This means there's no extra latency when the user hits Apply. The `AiModeResult` is cached on the ActionCard until applied or dismissed.

---

## Context Passing

The chat system prompt includes:

- Current node graph summary (node types, IDs, names) — so the AI can reference nodes by name
- The currently selected node, if any
- For `fix-error` tool: the error messages are injected by the trigger, not inferred by the AI

The node context used in a tool call is captured at the time of the tool call, not at confirm time. If the user selects a different node after the AI calls a tool, the ActionCard still operates on the original target.

---

## Node Context in Chat

ChatView already passes `selectedNodeInfo` context to the AI. This becomes more explicit:

```typescript
// In the chat system prompt context
interface ChatContext {
  nodes: {id: string; type: string; name?: string}[] // all nodes
  selectedNode?: {id: string; type: string; data: Record<string, unknown>}
}
```

This lets the AI say "I see you have an `osc~` node selected, I'll edit that" without the user needing to specify the node ID.

---

## AiModeDescriptor Extensions (spec 93 additions)

Two new optional fields on `AiModeDescriptor`:

```typescript
export interface AiModeDescriptor {
  // ... existing fields from spec 93 ...

  /** Whether this mode is available as a chat tool */
  availableInChat?: boolean

  /** One-line description for the LLM tool definition */
  chatToolDescription?: string

  /** JSON Schema for the tool's input parameters */
  chatToolSchema?: object
}
```

Modes that don't make sense in chat context (e.g. `create-consumer` and `create-producer` which are triggered by a specific right-click) set `availableInChat: false`.

---

## File Changes

### New files

- `src/lib/ai/chat/canvas-tools.ts` — builds tool definitions from descriptors
- `src/lib/components/sidebar/ActionCard.svelte` — inline confirm UI for tool results

### Modified files

- `src/lib/ai/chat/resolver.ts` — handle tool call events alongside text chunks
- `src/lib/ai/modes/types.ts` — add `availableInChat` + `chatToolDescription` + `chatToolSchema` to `AiModeDescriptor`
- `src/lib/ai/modes/descriptors.ts` — fill in new fields for applicable modes
- `src/lib/components/sidebar/ChatView.svelte` — pass canvas callbacks, render ActionCards

---

## Implementation Plan

Prerequisite: spec 93 mode resolver architecture is in place.

1. **Extend `AiModeDescriptor`** — add `availableInChat`, `chatToolDescription`, `chatToolSchema`
2. **Fill descriptor fields** — for `single`, `multi`, `edit`, `replace`, `fix-error`, `decompose`
3. **Build `canvas-tools.ts`** — generate tool definitions from descriptors
4. **Update `chat/resolver.ts`** — handle tool call events, call mode resolver, emit `ActionCard` data
5. **Build `ActionCard.svelte`** — pending / applied / dismissed states, uses descriptor color + icon
6. **Wire `ChatView.svelte`** — pass canvas callbacks down, render ActionCards in message thread
7. **Update chat context** — include node graph summary in system prompt

Steps 1–3 can be done in parallel with steps 4–5.
