# Modular Patchies

## Objective / Goal

We wanted to modularize patchies so that it became a headless-first, API-oriented patcher. The idea is that you can build plugins to extend patchies' functionality, add custom nodes on the fly, and use patchies without the node-based GUI.

1. Allow you to easily add third party modules to patchies with a few lines of code.
2. Keep the core engine lightweight.
3. Dynamically load heavy modules that may slow down the core
4. Allow headless usage of the patcher e.g. `patcher.add('glsl')`, so you can use Patchies as a backend for your app without the node-based GUI
5. Enable sub-patching and abstractions. We want objects to continue running even if it is not the top-level patches. Right now the lifecycle is tied to the Svelte component lifecycle, so it won't run if its in a subpatch.
6. Allow the use of AGPL-licensed components and libraries without making the Patchies core AGPL, so the Patchies core can be adopted in projects using any license.

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
  
## Define a new object

Define a `void` text object that does nothing:

```ts
class Void {
  static name = "void"
}

p.objects.define(Void)
```

Define a `delay` text object that delays messages via the `delay` parameter:

```ts
class Delay extends PatchObject {
  static name = "delay"
  
  static inlets = [
    // without declaring a type, the default inlet type is `msg` (any message)
    { name: "in" },
    { name: "delay", type: "float" }
  ]
  
  static outlets = [
    { type: "out" }
  ]

  async onMessage(m) {
    await sleep(this.getParam('delay'))
    send({type: "bang"})
  }
}

p.objects.define(Delay)
```

Define a `mtof` text object that converts MIDI note numbers to frequencies:

```ts
class MtofObject extends PatchObject {
  static name = 'mtof'
  

  static inlets = [
    {name: 'note', type: 'float'}
  ]

  static outlets = [
    {name: 'frequency', type: 'float'}
  ]

  onMessage(data, meta) {
    // ...
  }
}

p.objects.define(MtofObject)
```

## Use Vue.js to provide a view for an object

You can define the `getView(): Element` method to render a DOM element instead.

This allows you to use any libraries, such as Vue.js, to provide a view for an object.

```tsx

class Image {
  static name = "image"
  
  viewState = reactive({ imageUrl: null })
  
  async onMessage(m) {
    if (typeof m === 'string' && m.startsWith('http')) {
      this.setParam('src', m)
    }
  }
  
  getView() {
    const app = createApp(ImageView)
    const root = createElement('div')
    app.provide('state', this.viewState)
    app.mount(root)
    
    return root
  }
}

p.objects.define(Image)
```

## Video Renderer APIs

A video renderer lets you receive video inputs and emit video outputs.

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

p.video.define(GlslRenderer)
```

These APIs let you alter the video graph:

```ts
// set data, texture, uniform
video.upsertNode(id, type, data)
video.setNodeTexture(id, texture)
video.setNodeUniform(id, key, value)

// update bitmaps.
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

p.audio.define(OscNode)
```

These APIs lets you alter the audio graph:

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

## Rendering Svelte Objects

If the `viewComponent` is defined and it is a valid Svelte component, the object will render with the provided view component.

We recommend writing your view components in Svelte to make easy use of Svelte Flow.

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
  }
}

p.objects.define(GlslObject)
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
