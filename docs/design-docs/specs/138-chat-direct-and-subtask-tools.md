# 138. Chat Direct and Subtask Tools

**Status**: Implemented

## Progress

- Done: added direct chat canvas tools for `insert_object`, `insert_objects`,
  `update_object_data`, and `replace_object`.
- Done: strengthened `get_object_instructions` so direct tools can fetch object prompts, handle
  references, and compact schema context first.
- Done: added LLM-backed subtask tools for `generate_object_data` and `rewrite_object_data`; these
  should return structured data to the chat loop, not queue canvas actions directly.
- Done: added `generate_object_graph` as a graph-generation subtask.
- Done: removed legacy resolver-backed ChatView tools; `AiObjectPrompt` still uses mode resolvers
  directly.
- Done: direct chat validation accepts the generic `object` node type for text-style objects, while
  graph routing uses dedicated `out~` for speaker output.
- Done: removed stale ChatView tool metadata from mode descriptors.
- Done: added direct `delete_objects` as a reviewed, undoable canvas action.
- Done: added direct `move_objects` as a reviewed, undoable canvas action.

## Summary

Split Chat AI canvas tools into two explicit categories:

- **Direct tools**: deterministic canvas mutations where the chat model supplies the final structured
  action arguments, such as inserting an object, updating object data, connecting edges, or deleting
  edges.
- **Subtask tools**: LLM-backed helper tools that perform a smaller generation task and return
  structured data, such as generating object data from an object prompt, planning a multi-object
  patch, or rewriting code.

The current implementation already has the pieces for this split, but the boundary is blurry:
ChatView receives canvas tool calls, then most creation/editing tools call `runModeResolver()`, which
starts another LLM resolver flow. The new model keeps that capability for genuinely generative work
while allowing simple canvas actions to execute directly.

## Motivation

Simple user requests should not require a second LLM turn.

Examples:

- "Set this slider max to 1000"
- "Rename this node to bass"
- "Connect the button to the p5 sketch"
- "Move these objects to the left"

These are direct mutations. Running them through a resolver/subagent adds latency, hides the real
operation, and makes the tool trace harder to debug.

Creative generation still benefits from an LLM subtask:

- "Make a p5 sketch of a flocking system"
- "Create a connected kick/snare patch"
- "Fix this shader error"
- "Turn this JavaScript node into a Hydra visual"

Those requests need object-specific generation instructions, existing node context, code rewrite
behavior, or routing across object types.

## Current Architecture

Chat tool calling already works through `streamChatMessage()`:

1. The provider streams a model turn with optional `toolCalls`.
2. Context tools are executed and returned to the model as tool results.
3. Canvas tools are resolved into `ChatAction`s.
4. `ActionCard` lets the user apply or dismiss the pending action.
5. Applying an action calls `AiPromptCallbacks`, which route to `AiOperationsService`.

Important implementation files:

- `ui/src/lib/ai/chat/resolver.ts`
  - owns the multi-turn tool loop
  - separates context tools from canvas tools
  - executes context/subtask tools and queues direct canvas tools
- `ui/src/lib/ai/chat/chat-tool-declarations.ts`
  - declares context tools and direct edge tools
  - already includes `get_object_instructions`
- `ui/src/lib/ai/modes/run-resolver.ts`
  - routes mode tools to the existing LLM-backed resolvers
- `ui/src/lib/services/AiOperationsService.ts`
  - applies AI actions using undoable history commands

### Existing Object Prompt Tool

`get_object_instructions` already fetches object-specific generation context.

The resolver currently returns:

```ts
{
  instructions: getObjectSpecificInstructions(type),
  handleReference: generateHandleDocs([type])
}
```

This is the right primitive for direct object tools. Instead of eagerly putting every object prompt
into the main system prompt or hiding generation behind `runModeResolver()`, the chat model can:

1. call `get_object_instructions({ type })`
2. use the returned instructions and handle docs
3. call a direct mutation tool with final structured args

## Goals

- Make simple canvas actions one tool call plus validation, not another LLM resolver turn.
- Keep subtask tools available for object-data generation, code rewriting, multi-object planning, and
  error fixing.
- Make tool traces readable: users and developers should see the concrete action being queued.
- Reuse `get_object_instructions` as the object-prompt/context fetch tool.
- Keep ActionCard review and undo/redo semantics.
- Preserve the existing `AiObjectPrompt` mode resolver path for quick edit flows.

## Non-goals

- Remove the existing mode resolvers in one pass.
- Auto-apply actions by default.
- Make the chat model mutate SvelteFlow state directly.
- Replace object schemas or object prompts.
- Guarantee fully typed schemas for every object data shape in the first iteration.

## Tool Categories

### Context Tools

Context tools read state or documentation and return data to the model. They never create
`ChatAction`s.

Existing examples:

- `get_graph_nodes`
- `get_object_data`
- `get_object_errors`
- `get_object_instructions`
- `search_docs`
- `get_doc_content`
- `search_samples`

`get_object_instructions` should be documented in the system prompt as the required step before
directly creating or rewriting object data for a type the model has not already inspected in the
current tool loop.

### Direct Tools

Direct tools create pending `ChatAction`s from structured args without another LLM call.

Existing examples:

- `connect_edges`
- `disconnect_edges`

Implemented direct tools:

```ts
insert_object({
  type: string,
  data: Record<string, unknown>,
  position?: { x: number; y: number }
})
```

Creates one object. The model is responsible for supplying final object data. If it needs object API
details first, it should call `get_object_instructions`.

```ts
insert_objects({
  nodes: Array<{
    type: string;
    data: Record<string, unknown>;
    position?: { x: number; y: number };
  }>;
  edges?: Array<{
    source: number | string;
    target: number | string;
    sourceHandle?: string;
    targetHandle?: string;
  }>;
})
```

Creates multiple objects and optional edges in one pending action. This is direct when the model has
already produced final node data. It should share validation/layout logic with the current
multi-object insert path.

```ts
update_object_data({
  nodeId: string,
  patch: Record<string, unknown>,
  replace?: boolean
})
```

Updates an existing node's `data`. By default, merge `patch` into existing data using the same
preservation rules as `AiOperationsService.editNode()`. If `replace` is true, replace user-facing
data while still preserving internal fields.

```ts
replace_object({
  nodeId: string,
  type: string,
  data: Record<string, unknown>,
});
```

Replaces one node with another type and data, using the existing reconnect/undo semantics in
`AiOperationsService.replaceNode()`.

```ts
delete_objects({
  nodeIds: string[];
});
```

Deletes existing objects using undoable delete commands. This is a reviewed action.

```ts
move_objects({
  positions: Array<{ nodeId: string; position: { x: number; y: number } }>;
});
```

Moves objects using undoable move commands. Useful for layout cleanup without regenerating nodes.

### Subtask Tools

Subtask tools may call an LLM internally and return structured output to the main chat loop. They do
not directly apply canvas changes. They are for "think/write/generate this artifact" rather than
"perform this mutation".

Initial subtask tools can wrap existing resolvers:

```ts
generate_object_data({
  type?: string,
  prompt: string,
  existingData?: Record<string, unknown>
})
```

If `type` is absent, this may route to an object type first. If `type` is present, skip routing and
generate data with `buildObjectTypeInstructions(type)`.

```ts
rewrite_object_data({
  type: string,
  existingData: Record<string, unknown>,
  prompt: string,
  errors?: string[]
})
```

Uses the existing edit/fix resolver behavior and returns proposed `data`.

```ts
generate_object_graph({
  prompt: string;
});
```

Returns generated nodes and edges without queuing an action. The chat model can inspect the result
and then call `insert_objects` with final args.

Legacy resolver-backed chat tools should be removed from ChatView. Their behavior can be expressed
as context/subtask tools followed by direct canvas tools.

## Expected Flows

### Simple Direct Edit

User: "Set this slider max to 1000."

```text
assistant -> get_object_data({ objectId: "slider-1" })
tool      -> { id, type: "slider", data: { min: 0, max: 127, value: 64 } }
assistant -> update_object_data({
  nodeId: "slider-1",
  patch: { max: 1000 }
})
tool      -> { status: "queued", actionId }
assistant -> "Queued an update to set the slider max to 1000."
```

No subtask LLM call is needed.

### Direct Create With Prompt Fetch

User: "Create a p5 sketch with bouncing circles."

```text
assistant -> get_object_instructions({ type: "p5" })
tool      -> { instructions, handleReference }
assistant -> insert_object({
  type: "p5",
  data: { code: "...", title: "Bouncing Circles" }
})
tool      -> { status: "queued", actionId }
assistant -> "Queued a p5 sketch for you to apply."
```

The main chat model writes the object data after fetching the object prompt.

### Graph Subtask Then Direct Create

User: "Make a connected kick and snare patch."

```text
assistant -> generate_object_graph({ prompt: "connected kick and snare patch" })
tool      -> { nodes, edges }
assistant -> get_object_instructions({ type: "tone~" })
assistant -> get_object_instructions({ type: "button" })
assistant -> insert_objects({ nodes, edges })
tool      -> { status: "queued", actionId }
assistant -> "Queued the drum patch with buttons connected to drum voices and output."
```

The subtask handles graph generation, but the final canvas mutation is still a direct tool.

### Error Fix

User: "Fix the selected shader."

```text
assistant -> get_object_errors({ objectIds: ["glsl-2"] })
tool      -> { "glsl-2": ["..."] }
assistant -> rewrite_object_data({
  type: "glsl",
  existingData: { code: "..." },
  errors: ["..."],
  prompt: "Fix the selected shader"
})
tool      -> { data: { code: "..." } }
assistant -> update_object_data({
  nodeId: "glsl-2",
  patch: { code: "..." }
})
```

The LLM-backed step produces a rewrite, and the direct step queues the concrete edit.

## Validation Rules

Direct tools must validate before emitting a pending action:

- Node IDs must exist for node-scoped operations.
- Object types must exist in `objectSchemas` or the enabled object registry.
- Edge endpoints must exist.
- Edge handles should be validated with existing schema/handle utilities where possible.
- Object data must be JSON-serializable.
- Internal fields are protected:
  - preserve `name`, `executeCode`, `initialized`
  - reject or ignore keys starting with `__`
- Code updates should trigger `executeCode` the same way `AiOperationsService.editNode()` does.
- Direct insert tools should use the same position defaults and node ID generation path as existing
  AI insert operations.

Validation failures should create failed `ChatAction`s or tool results with actionable messages, not
silently drop work.

## ActionCard Behavior

Direct tools should still create reviewed `ChatAction`s by default. The model has agency to propose
work; the user keeps agency to apply it.

ActionCard should be able to display:

- created object type and title/name
- object data fields changed
- replacement type
- edge count
- deleted node count
- moved node count

For `update_object_data`, show a diff of changed top-level keys when possible. Large code fields can
show a collapsed "code changed" row instead of dumping the whole string.

## System Prompt Rules

Update the chat system prompt with the new tool-selection policy:

1. Use direct tools for concrete mutations when final args are known.
2. Use context tools before direct tools when object IDs, existing data, errors, handles, or object
   instructions are needed.
3. Call `get_object_instructions` before writing non-trivial object data for a type unless those
   instructions are already present in the current conversation/tool loop.
4. Use subtask tools only when a generation/rewrite/planning step is required.
5. After a subtask returns structured output, call a direct tool to queue the actual canvas mutation.
6. Do not call resolver-backed mode tools from ChatView.

## Implementation Plan

### Phase 1: Tool Taxonomy and Names

- Add tool category metadata to chat tool declarations: `context`, `direct`, or `subtask`.
- Rename UI labels from "subagent" to "subtask" for LLM-backed tools.
- Keep existing mode resolvers available to `AiObjectPrompt`.
- Update system prompt language to explain the new categories.

### Phase 2: Direct Object Mutation Tools

- Add direct declarations for `insert_object`, `insert_objects`, `update_object_data`, and
  `replace_object`.
- Add resolver handlers that validate args and emit `ChatAction` results without calling
  `runModeResolver()`.
- Extend `AiModeResult` or introduce a parallel `ChatDirectActionResult` if mode terminology starts
  fighting the design.
- Reuse `AiOperationsService` for apply behavior and undo/redo.

### Phase 3: Subtask Tool Wrappers

- Add `generate_object_data`, `rewrite_object_data`, and `generate_object_graph` as context-like
  tools that return structured data to the main chat loop.
- Internally reuse existing single/edit/multi resolvers.
- Make their tool results visible in the expanded tool-call UI.

### Phase 4: Prompt Fetch First

- Strengthen `get_object_instructions`:
  - return `type`
  - return `instructions`
  - return `handleReference`
  - optionally return schema summary from `objectSchemas[type]`
- Update tool descriptions so direct object creation/editing references this tool.
- Add tests or eval cases where the model creates a p5/glsl/strudel object only after fetching
  instructions.

### Phase 5: Compatibility Migration

- Remove legacy resolver-backed mode tools from ChatView.
- Keep current resolver-backed mode tools for `AiObjectPrompt`.
- Prefer direct tools in the system prompt and evals.
- Re-express removed chat tools as context/subtask/direct sequences:
  - `insert` → `get_object_instructions` + optional `generate_object_data` + `insert_object`
  - `edit` / `fix_error` → `get_object_data` / `get_object_errors` + optional
    `rewrite_object_data` + `update_object_data`
  - `turn_into` → `get_object_data` + optional `generate_object_data` / `rewrite_object_data` +
    `replace_object`
  - `split` / `fork` → `get_object_data` + optional generation/rewrite + `insert_object` or
    `insert_objects`
  - `multi` → `generate_object_graph` + `insert_objects`

## Open Questions

- Should `insert_object` allow any `data` shape, or should it validate against per-object schemas
  once object data schemas are stronger?
- Should direct object creation auto-fetch instructions at the resolver layer when the model skipped
  `get_object_instructions`, or should that be enforced only by prompt/evals?
- Should `generate_object_data` stay model-visible long term, or should some flows wrap it behind
  higher-level orchestration?
- Should `update_object_data` support JSON Patch operations for nested edits, or is shallow merge
  enough for v1?
- Should auto-approve ever apply direct tools immediately, or should all direct tools remain
  reviewed because they mutate the canvas?

## Success Criteria

- A simple slider/property edit queues an `update_object_data` action without invoking
  `runModeResolver()`.
- Creating one known object can happen through `get_object_instructions` followed by
  `insert_object`.
- Multi-object creative generation can use a subtask tool, then queue a direct `insert_objects`
  action.
- Tool call UI distinguishes direct actions from LLM-backed subtasks.
- All applied actions remain undoable through existing history commands.
- Existing AiObjectPrompt quick-edit behavior continues to work.
