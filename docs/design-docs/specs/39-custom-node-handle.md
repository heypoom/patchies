# 39. Custom Node Handle

We have 63 occurences of `<Handle` usage in the codebase, and 15 usages of `<VideoHandle`.

I want to standardize the way we use handles across all nodes, and create a custom handle component that wraps around the existing `Handle` component from `xyflow`, similar to VideoHandle. Let's create a `StandardHandle` component that can be used for all types of nodes, including video, audio, and text.

## Constructing IDs

Constructing the underlying ID is a bit complex. You have to consider all of the following patterns:

This will construct an underlying id of `video-in-0`, based on the port, type and id.

```svelte
<StandardHandle
  port="inlet"
  type="video"
  id="0"
  title="Image input (Optional)"
  total={1}
  index={2}
  class=""
/>
```

And this will become `video-out-0`:

```svelte
<StandardHandle
  port="outlet"
  type="video"
  id="0"
  title="Image input (Optional)"
  total={1}
  index={2}
  class=""
/>
```

The `id` can be string, because GLSLCanvasNode needs to encode more information in the handle id. This will construct `id` of `video-in-0-iChannel0-sampler2D`.

```svelte
<StandardHandle
  port="inlet"
  type="video"
  id="0-iChannel0-sampler2D"
  title="iChannel0 (sampler2D)"
  total={1}
  index={2}
  class=""
/>
```

If the `id` is not provided, only use the port and type information. This will be `audio-in`.

```svelte
<StandardHandle
  port="inlet"
  type="audio"
  title="Audio Inlet"
  total={1}
  index={2}
  class=""
/>
```

And this will be `message-in`:

```svelte
<StandardHandle
  port="inlet"
  type="message"
  total={1}
  index={2}
  class=""
/>
```

## Calculating Position

`total` and `index` are passed as input to getPortPosition to calculate the left styles. Under the hood, it should apply the following style. Make sure to set `!absolute z-1`.

```svelte
class="!absolute z-1"
style={`left: ${getPortPosition(total, index)}`}.
```
