# 99. Chat Connect Edges Tool

## Summary

Add a `connect_edges` tool call to the ChatView AI, allowing the AI to connect existing nodes on the canvas by creating edges between them. This is a direct canvas action (no AI code generation needed) — the AI specifies source/target node IDs and handle IDs.

## Motivation

Currently the AI can create nodes (insert/multi), edit nodes, replace nodes, and fix errors. But it cannot connect two existing nodes that are already on the canvas. Users may ask "connect the oscillator to the filter" and the AI should be able to do this directly.

## Design

### Tool Schema

```json
{
  "name": "connect_edges",
  "description": "Connect existing nodes by creating edges between them.",
  "parameters": {
    "type": "object",
    "properties": {
      "edges": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "source": { "type": "string", "description": "Source node ID" },
            "target": { "type": "string", "description": "Target node ID" },
            "sourceHandle": { "type": "string", "description": "Source handle ID (e.g. 'message-out', 'audio-out')" },
            "targetHandle": { "type": "string", "description": "Target handle ID (e.g. 'message-in', 'audio-in')" }
          },
          "required": ["source", "target"]
        }
      }
    },
    "required": ["edges"]
  }
}
```

### Result Kind

New `AiModeResult` variant:
```typescript
{ kind: 'connect-edges'; edges: Edge[] }
```

### Flow

1. AI calls `connect_edges` with edge specs
2. Resolver validates node IDs exist, builds `Edge[]` objects
3. Emits `ChatAction` with `connect-edges` result kind
4. ActionCard shows summary (e.g. "Connect 2 edges")
5. On apply, `AiOperationsService.connectEdges()` adds edges via `AddEdgesCommand` (undo-able)

### Undo Support

Uses existing `AddEdgesCommand` which supports both `execute()` and `undo()`.

## Files Modified

- `ui/src/lib/ai/modes/types.ts` — add result kind + mode
- `ui/src/lib/ai/ai-prompt-controller.svelte.ts` — add callback
- `ui/src/lib/ai/chat/resolver.ts` — add tool declaration + handling
- `ui/src/lib/ai/chat/canvas-tools.ts` — add to CONNECT_EDGES constant
- `ui/src/lib/ai/modes/descriptors.ts` — add descriptor
- `ui/src/lib/services/AiOperationsService.ts` — add connectEdges()
- `ui/src/lib/components/FlowCanvasInner.svelte` — wire callback
- `ui/src/lib/components/sidebar/ActionCard.svelte` — handle result kind
- `ui/src/lib/components/sidebar/ChatView.svelte` — handle in applyAction
