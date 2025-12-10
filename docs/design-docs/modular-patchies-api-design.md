# Modular Patchies

## Goal

We wanted to modularize patchies so that it became an API-oriented patcher, where you can build plugins to extend patchies' functionality and add custom nodes.

1. Allow you to easily add third party modules to patchies with a few lines of code.
2. Keep the core engine lightweight.
3. Dynamically load heavy modules that may slow down the core
4. Allow headless usage of the patcher e.g. `patcher.add('glsl')`, so you can use Patchies as a backend for your app without the node-based GUI
5. Enable sub-patching and abstractions. We want objects to continue running even if it is not the top-level patches. Right now the lifecycle is tied to the Svelte component lifecycle, so it won't run if its in a subpatch.
6. Allow the use of AGPL-licensed libraries without making the Patchies core AGPL, so the Patchies core can be adopted in projects using any license.

## Patchies' Services

Patchies should provide a set of API that lets you access its internal services.

- **Video**: registers new video nodes in the render graph that is capable of rendering video frames.
- **Audio**: registers new audio nodes in the audio graph that is capable of processing audio frames.
  - **Audio Scheduler**
- **MIDI**: listens to MIDI events and send MIDI messages
- **Audio Analysis**: runs fft analysis on audio sources
- **Objects**: registers new objects and create, update and destroy objects in the patcher.
  - **Messaging**: allows listening to messages and sending messages between objects
  - **Svelte UI**: allows registering Svelte view components
  
## Registering a new object

Register a `void` text object that does nothing:

```ts
class Void {
  static name = "void"
}

p.registerObject(void)
```

Register a `delay` text object that delays messages:

```ts
class Delay {
  static name = "delay"
  
  static inlets = [
    { name: "in", type: "msg" },
    { name: "delay", type: "float" }
  ]
  
  static outlets = [
    { type: "out", type: "bang" }
  ]

  async onMessage(m) {
    await sleep(this.param("delay"))
    send({type: "bang"})
  }
}

p.registerObject(Delay)
```

## HTML Renderer API

```tsx
class Image {
  static name = "image"
  
  // return string or DOM element
  getHtml() {
    return `<img src="${this.args.url}">`
  }
}
```

## Video Renderer APIs

The following registers the `glsl` renderer in the video graph.

```ts
class GlslRenderer {
  static name = "glsl"

  constructor(renderNode, framebuffer) {

  }

  render() {
    
  }

  cleanup() {

  }

  getUniforms(renderNode, fboNode) {
    return []
  }

  // optional: handles FFT packages
  onFFT(payload) {
    // ...
  }
}

register(renderer)
```

These APIs let you alter the patch

```ts
// set data, texture, uniform
video.upsertNode(id, type, data)
video.setNodeTexture(id, texture)
video.setNodeUniform(id, key, value)

// update external bitmaps
video.setNodeBitmap(id, bitmap)
video.removeNodeBitmap(id)

// pause/play + preview
video.isNodePaused(id)
video.toggleNodePaused(id)
video.setNodePreviewEnabled(id, true)

// rendering context
video.setNodePreviewContext(id, bitmapCtx)
video.removeNodePreviewContext(id, bitmapCtx)

video.getOutputBitmap(): ImageBitmap
```

## Audio APIs

```ts
class OscNode {
  static name = "osc~"
  audioContext: AudioContext

  constructor(nodeId, params) {
    
  }

  cleanup() {

  }

  onConnect(source, target, context) {
    const { param, sourceHandleId } = context
  }

  onMessage(key, message) {
    
  }

  // e.g. 'frequency' -> AudioParam
  getAudioParam(key) {

  }
}

register(OscNode)
```

```ts
// create/remove nodes
createNode('node-id', parameters)
removeNode('node-id')

// send message
send('node-id', key, message)

// update edges
updateEdges(edges)

// output gain
setOutputGain(value)
getOutputGain()
```

## Text Objects

If the `viewComponent` is not defined, the object will be rendered as a text object.

```ts
class MtofObject extends PatchObject {
  static name = 'mtof'
  static description = '...'
  static tags = ['helper']

  static inlets = [
    {name: 'note', type: 'float'}
  ]

  static outlets = [
    {name: 'frequency', type: 'float'}
  ]

  onCreate() {
    
  }

  onDestroy() {
    
  }

  onMessage(data, meta) {
    let inlet = getInlet(meta)
  }
}

objects.register(MtofObject)
```

## Svelte for UI Objects

If the `viewComponent` is defined, the object will render using the provided view component.

```ts
import GLSLView from './GLSLView.svelte'

class GlslObject extends PatchObject {
  static name = 'glsl'
  static viewComponent = GLSLView

  onCreate() {
    
  }

  onDestroy() {
    
  }

  onMessage(data, meta) {
    if (meta.inletKey.startsWith(...)) {
      video.setNodeUniform(id, name, msg) 
    }

    // set and run
  }
}

objects.register(GlslObject)
```

```svelte
<script lang="ts">
  let previewCtx

  onMount(() => {
    previewCtx = canvas.getContext(...)
    video.setNodePreviewContext(...)
  })

  onDestroy(() => {
    video.removeNodePreviewContext(...)
  })
</script>

<PreviewCanvas>

</PreviewCanvas>
```
