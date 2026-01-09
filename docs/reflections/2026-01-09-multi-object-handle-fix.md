# Multi-Object AI Handle ID Fix

**Date**: 2026-01-09  
**Issue**: AI-generated multi-object patches had edge connection errors

## Problems Identified

### 1. tone~ Message Inlets Timing Issue

**Root Cause**: tone~ nodes call `setPortCount(1)` in their user code to create message inlets, but this happens AFTER the node is mounted. When edges were created immediately after nodes, the message inlet handles didn't exist yet, causing React Flow to fail creating the edges.

**Solution**: Pre-parse tone~ code to extract `setPortCount()` calls and set `messageInletCount`/`messageOutletCount` in the node data BEFORE adding nodes to the canvas. This ensures StandardHandle components generate the correct handles immediately.

```typescript
// In handleAiMultipleObjectsInsert()
if (objNode.type === "tone~" && nodeData.code) {
  const portCountMatch = nodeData.code.match(
    /setPortCount\((\d+)(?:,\s*(\d+))?\)/
  );
  if (portCountMatch) {
    const inletCount = parseInt(portCountMatch[1] || "0", 10);
    const outletCount = parseInt(portCountMatch[2] || "0", 10);
    nodeData = {
      ...nodeData,
      messageInletCount: inletCount,
      messageOutletCount: outletCount,
    };
  }
}
```

### 2. AI Generated Wrong Node Type for dac~

**Root Cause**: AI was generating `{ type: "dac~" }` but `dac~` is not a direct node type in Patchies. Audio objects like `dac~`, `gain~`, `osc~`, etc. must be created using the `object` node type with `data.expr` set to the object name.

**Correct Pattern**:

```json
{
  "type": "object",
  "data": {
    "expr": "dac~",
    "name": "dac~",
    "params": []
  }
}
```

**Solution**:

1. Added comprehensive instructions for the "object" node type in `object-descriptions.ts`
2. Updated router prompt examples to show "object" usage
3. Clarified in OBJECT_TYPE_LIST that audio objects are created via "object" type

### 3. AI Tried to Connect to Non-Existent dac~ Inlets

**Root Cause**: AI was generating edges trying to connect 6 drum sounds to `audio-in-0`, `audio-in-1`, ..., `audio-in-5` on dac~, but `dac~` has only ONE audio inlet.

**Key Insight**: Web Audio's GainNode (which dac~ uses) automatically SUMS multiple connections to the same inlet. This is the correct behavior!

**Solution**: Updated AI instructions to clarify:

- dac~ has ONLY ONE audio inlet: `audio-in-0`
- Multiple sources CAN and SHOULD connect to the SAME `audio-in-0` handle
- Web Audio automatically mixes multiple connections
- DO NOT create multiple dac~ nodes for each source

## Files Modified

1. **ui/src/lib/components/FlowCanvasInner.svelte** (lines 311-328)
   - Pre-parse tone~ code for setPortCount() calls
2. **ui/src/lib/ai/object-descriptions.ts**

   - Added comprehensive "object" node type instructions (case 'object')
   - Updated OBJECT_TYPE_LIST to clarify audio objects via "object" type
   - Included examples showing correct dac~ creation pattern

3. **ui/src/lib/ai/multi-object-resolver.ts** (lines 297-316)
   - Added instructions about audio objects via "object" node type
   - Added dac~ single-inlet rules with multi-connection pattern
   - Added router prompt example for 808 drums using "object" type

### 4. tone~ Handle ID Pattern Mismatch

**Root Cause**: SimpleDspLayout creates message inlets with `id={index}`, generating handle IDs like `message-in-0`, `message-in-1`, etc. But the AI instructions said to use `message-in` (without index) for tone~ nodes, causing a mismatch.

**Key Insight**: Even when `setPortCount(1)` creates only ONE message inlet, it's still indexed as `message-in-0` (not `message-in`). This is because SimpleDspLayout always uses indexed handles for dynamic message ports.

**Solution**: Updated AI instructions to clarify:
- tone~ message inlets are ALWAYS indexed: `message-in-0`, `message-in-1`, etc.
- Even with `setPortCount(1)`, use `targetHandle: "message-in-0"` (NOT `"message-in"`)
- Added explicit example showing button → tone~ → dac~ with correct handle IDs

## Testing Recommendation

Test with prompt: "make an 808 drum machine"

Expected behavior:

- 6 buttons created (one per drum sound)
- 6 tone~ nodes created with correct message inlets
- 1 object node created with expr: "dac~"
- All tone~ audio outlets connect to same dac~ "audio-in-0" inlet
- No React Flow edge creation errors
- Clicking any button triggers its drum sound through speakers

## What Could Be Better

1. **Dynamic Port Count Updates**: Currently only tone~ has pre-parsing. Other node types with dynamic ports (dsp~, elementary~) might have similar issues.

2. **AI Understanding of Web Audio Mixing**: While fixed for dac~, the AI might still struggle with other mixing scenarios. Consider adding more examples of multi-source → single-inlet patterns.

3. **Validation Layer**: Could add a validation step that checks generated edges against actual node handle capabilities before applying them.

## Action Items

- [ ] Test multi-object generation with various audio scenarios
- [ ] Monitor for similar timing issues with dsp~ and other dynamic nodes
- [ ] Consider adding edge validation warnings in development mode
