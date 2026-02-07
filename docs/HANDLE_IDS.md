# Handle ID Reference Guide

This guide explains how StandardHandle generates and manages connection IDs in Patchies.

## StandardHandle Component

Location: `src/lib/components/StandardHandle.svelte` (lines 20-28)

Handle IDs are **auto-generated** based on props. They are NOT hardcoded static strings.

## ID Generation Algorithm

The StandardHandle component uses this logic to generate handle IDs:

```typescript
const handleId = $derived.by(() => {
  const portDir = port === 'inlet' ? 'in' : 'out';

  return match({ type, id })
    .with({ type: P.string, id: P.not(P.nullish) }, ({ type, id }) => `${type}-${portDir}-${id}`)
    .with({ type: P.string, id: P.nullish }, ({ type }) => `${type}-${portDir}`)
    .with({ type: P.nullish, id: P.not(P.nullish) }, ({ id }) => `${portDir}-${id}`)
    .otherwise(() => port);
});
```

## ID Patterns

### Pattern 1: Type + Direction (Most Common)
**When**: `type` provided, no `id`
**Result**: `${type}-${portDir}`

Examples:
- `<StandardHandle port="inlet" type="message" ... />` → `message-in`
- `<StandardHandle port="outlet" type="audio" ... />` → `audio-out`
- `<StandardHandle port="inlet" type="video" ... />` → `video-in`

Used in: ButtonNode, ToggleNode, simple single-port nodes

### Pattern 2: Type + Direction + Index ID
**When**: `type` provided, `id={index}` (number or string)
**Result**: `${type}-${portDir}-${id}`

Examples:
- `<StandardHandle port="inlet" type="message" id={0} ... />` → `message-in-0`
- `<StandardHandle port="outlet" type="audio" id={1} ... />` → `audio-out-1`
- `<StandardHandle port="inlet" type="video" id="0" ... />` → `video-in-0`

Used in: ObjectNode (dynamic inlets/outlets), Hydra (multiple video I/O), ChuckNode

### Pattern 3: Type + Direction + String Label ID
**When**: `type` provided, `id="label-string"`
**Result**: `${type}-${portDir}-${label}`

Examples:
- `<StandardHandle port="inlet" type="audio" id="audio-in" ... />` → `audio-in-in`
- `<StandardHandle port="inlet" type="message" id="message-in" ... />` → `message-in-in`
- `<StandardHandle port="outlet" type="video" id="out" ... />` → `video-out-out`

Used in: SamplerNode, SoundFile, GLSLCanvasNode (simple labels)

### Pattern 4: Direction Only + Index ID
**When**: No `type`, `id={index}` provided
**Result**: `${portDir}-${id}`

Examples:
- `<StandardHandle port="inlet" id={0} ... />` → `in-0`
- `<StandardHandle port="outlet" id={1} ... />` → `out-1`

Used in: AiImageNode (when type varies dynamically)

### Pattern 5: Complex Dynamic ID
**When**: `type` and complex template `id=\`...\``
**Result**: `${type}-${portDir}-${computed_id}`

Examples (GLSL shader uniforms):
```svelte
<StandardHandle
  port="inlet"
  type={def.type === 'sampler2D' ? 'video' : 'message'}
  id={`${defIndex}-${def.name}-${def.type}`}
  ...
/>
```
Results in:
- `video-in-0-position-sampler2D`
- `message-in-1-opacity-float`
- `message-in-2-color-vec3`

Used in: GLSLCanvasNode (dynamic uniform inlets based on shader code)

### Pattern 6: Port Only (Default)
**When**: Neither `type` nor `id` provided
**Result**: `${port}` (just "inlet" or "outlet")

Examples:
- `<StandardHandle port="inlet" ... />` → `inlet`
- `<StandardHandle port="outlet" ... />` → `outlet`

⚠️ **Not recommended** - only as fallback. Causes edge connection errors if multiple handles exist.

## Real-World Examples

### ButtonNode (Simple)
```svelte
<!-- Message inlet: generates "message-in" -->
<StandardHandle port="inlet" type="message" total={1} index={0} />

<!-- Message outlet: generates "message-out" -->
<StandardHandle port="outlet" type="message" total={1} index={0} />
```

### ObjectNode (Dynamic Audio/Message Ports)
```svelte
<!-- Each inlet with auto-index: generates "in-0", "in-1", etc. -->
{#each inlets as inlet, index}
  <StandardHandle
    port="inlet"
    type={getPortType(inlet)}  <!-- 'audio' or 'message' -->
    id={index}
    title={inlet.name}
    total={inlets.length}
    {index}
  />
{/each}

<!-- Result: "audio-in-0", "message-in-1", "audio-in-2", etc. -->
```

### HydraNode (Multiple Video/Message Ports)
```svelte
<!-- Video inlets: generates "video-in-0", "video-in-1", etc. -->
{#each Array.from({ length: videoInletCount }) as _, index}
  <StandardHandle
    port="inlet"
    type="video"
    id={index.toString()}
    title={`Video Inlet ${index}`}
    ...
  />
{/each}

<!-- Message inlets: generates "message-in-2", "message-in-3", etc. -->
{#each Array.from({ length: messageInletCount }) as _, index}
  <StandardHandle
    port="inlet"
    type="message"
    id={index + videoInletCount}  <!-- Offset by video count -->
    title={`Message Inlet ${index}`}
    ...
  />
{/each}
```

### GLSLCanvasNode (Complex Dynamic)
```svelte
<!-- For each uniform in shader, generates unique ID -->
{#each data.glUniformDefs as def, defIndex}
  <StandardHandle
    port="inlet"
    type={def.type === 'sampler2D' ? 'video' : 'message'}
    id={`${defIndex}-${def.name}-${def.type}`}
    title={`${def.name} (${def.type})`}
    ...
  />
{/each}

<!-- Results in IDs like:
     "video-in-0-iChannel0-sampler2D"
     "message-in-1-iMix-float"
     "message-in-2-iColor-vec3"
-->
```

## Connection Issues & Debugging

### Error: "Couldn't create edge for target handle id: X"

This means the handle ID in the edge definition doesn't match the actual handle ID in the node.

**Debug steps**:
1. Open browser console and check edge data:
   ```javascript
   console.log(edges); // Look at targetHandle values
   ```
2. Inspect node handles in React Flow dev tools
3. Verify StandardHandle props match the edge's targetHandle/sourceHandle

**Common causes**:
- AI-generated patches using hardcoded IDs like `"message-in-message-in"`
- Dynamic port count changed (e.g., Hydra video inlet count increased)
- GLSL shader code changed, uniforms added/removed
- Mismatch between `id` prop and what the edge expects

### Fixing Edge Mismatches

**For newly generated patches**: Make sure object-descriptions.ts doesn't specify hardcoded handle IDs. Let the StandardHandle component generate them.

**For existing patches with broken edges**: Reload the patch. If handles changed, edges are automatically cleaned up (see GLSLCanvasNode.removeInvalidEdges).

## Guidelines for AI Prompts

**In object-descriptions.ts**: DO NOT mention specific handle IDs in instructions. The AI cannot control how React Flow generates them, and hardcoded IDs will cause errors.

❌ **Wrong**:
```
HANDLE IDS (for connections):
- Message inlet: "message-in-message-in"
- Audio outlet: "audio-out-audio-out"
```

✅ **Right**:
```
Connect to out~ for audio output.
Messages can be sent to control playback.
```

The StandardHandle component will auto-generate appropriate IDs based on how the node is implemented.

## Implementation Checklist

When creating a new node with handles:

- [ ] Use `<StandardHandle>` component (never manual `<Handle>`)
- [ ] Provide `port="inlet"` or `port="outlet"`
- [ ] Provide `type` (e.g., "audio", "video", "message") or `id` or both
- [ ] Provide `total` (count of all handles in that port direction)
- [ ] Provide `index` (position of this handle among total)
- [ ] Provide `title` (descriptive tooltip)
- [ ] Let StandardHandle auto-generate the ID
- [ ] Test connections work correctly in UI
- [ ] Never hardcode expected handle IDs in AI prompts

## See Also

- `src/lib/components/StandardHandle.svelte` - Implementation
- `CLAUDE.md` - Architecture overview
- `src/lib/utils/node-utils.ts` - `getPortPosition()` for auto-positioning
