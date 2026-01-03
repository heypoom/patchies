# Convolver Auto-Read Feature Implementation

## Objective

Simplify the user workflow for using `convolver~` by automatically detecting when `soundfile~` is connected to `convolver~`'s `buffer` inlet and automatically reading/sending the audio buffer without requiring manual `{ type: 'read' }` messages.

## Problem Statement

Previously, to use `convolver~` for reverb effects, users had to:

1. Load an audio file into `soundfile~`
2. Manually send a `{ type: 'read' }` message to trigger buffer reading
3. Connect the output to `convolver~`'s `buffer` inlet

This workflow was unintuitive because the connection implied data flow, but the buffer wasn't automatically sent.

## Solution Design

Implemented **automatic buffer detection and transmission** by:

1. **Adding a helper method to MessageSystem** (`getConnectedEdgesToTargetInlet`) to query which target nodes and inlets a source node connects to.

2. **Implementing auto-detection in SoundFile.svelte** via `autoReadIfConnectedToConvolver()` function that:

   - Checks all outgoing connections from the soundfile~ node
   - Identifies if any target is a `ConvolverNodeV2` with a `buffer` inlet
   - Automatically reads and sends the audio buffer if such a connection exists

3. **Triggering auto-read on two events**:
   - When a file is loaded (via `loadFile()`)
   - When a URL is set (via `setUrl()`)

## Implementation Details

### MessageSystem Enhancement

Added `getConnectedEdgesToTargetInlet()` method to MessageSystem:

```typescript
getConnectedEdgesToTargetInlet(
  sourceNodeId: string,
  targetInletKey?: string
): Array<{ targetNodeId: string; inletKey: string | null | undefined }>
```

This method returns all edges connected from a source node, filtered by an optional inlet key pattern.

### SoundFile Component Changes

1. **Imports added**:

   - `MessageSystem` for accessing edge information
   - `AudioService` for node lookup
   - `getNodeType` utility for type checking

2. **New function**: `autoReadIfConnectedToConvolver()`

   - Uses MessageSystem to query connected targets
   - Checks if target is a ConvolverNodeV2
   - Looks for "buffer" in the inlet key
   - Calls `readAudioBuffer()` if match found

3. **Integration points**:
   - Called in `loadFile()` after updating node data
   - Called in `setUrl()` after updating node data

## Backward Compatibility

- The manual `{ type: 'read' }` message handling is preserved
- Users can still manually trigger buffer reading if needed
- Existing patches continue to work without changes

## Testing Strategy

Manual testing required:

1. Create a `convolver~` object node
2. Create a `soundfile~` node
3. Load an audio file into soundfile~
4. Connect soundfile~ output to convolver~'s `buffer` inlet
5. **Expected**: Buffer should automatically be sent and convolver starts working
6. Test with different file types (WAV, MP3, OGG)
7. Test reconnecting to ensure auto-read triggers again

## Edge Cases Handled

- **No connection**: Auto-read check safely returns early if no file is loaded
- **Multiple connections**: Checks all connected targets, reads on first match
- **Target not yet created**: Safely handles case where audioService.getNode() returns null
- **Connection changes**: Auto-read checks happen on file load, so connection changes are picked up

## Implementation - Edge Watching

Added a Svelte 5 reactive effect that watches for edge changes on THIS node specifically:

- Uses `getEdges()` to get all current edges
- Filters to only edges where this node is the source (outgoing connections)
- Triggers `autoReadIfConnectedToConvolver()` whenever the edge list changes and file is loaded
- This enables auto-read even if the file was loaded BEFORE the connection was made

The effect is scoped efficiently to only react to changes in edges involving this specific node.

## Future Improvements

1. **Connection feedback**: Visual indicator showing whether soundfile~ is connected to convolver~
2. **Multi-target support**: Could extend to other node types that accept buffers (e.g., future granular synthesis nodes)
3. **Error handling**: Visual feedback if buffer fails to decode

## Files Changed

- `ui/src/lib/messages/MessageSystem.ts` - Added helper method
- `ui/src/lib/components/nodes/SoundFile.svelte` - Added auto-detection logic

## Impact Assessment

- **Positive**: Much simpler UX for convolver workflow
- **Performance**: Minimal - only one additional connection check per file load
- **Breaking changes**: None - fully backward compatible
