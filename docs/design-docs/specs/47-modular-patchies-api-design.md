# Modular Patchies

## Problem

Right now, it's very hard to add new objects to Patchies. The codebase is tightly coupled and messy. 

It's also not possible to implement a plugin system e.g. dynamically adding modules that exposes new objects from a marketplace.

## Goal

We wanted to modularize patchies so that it can become a lightweight core library that can dynamically load additional modules.

The idea is that you can build plugins to extend patchies' functionality, add custom nodes on the fly, and use patchies without the node-based GUI.

1. Allow you to easily add third party modules to patchies with a few lines of code.
2. Keep the core engine lightweight.
3. Dynamically load heavy modules that may slow down the core
4. Allow headless usage of the patcher e.g. `p.objects.add({x, y, type: 'glsl'})`, so you can use Patchies as a backend for your app without the node-based GUI
5. Enable sub-patching and abstractions. We want objects to continue running even if it is not the top-level patches. Right now the lifecycle is tied to the Svelte component lifecycle, so it won't run if its in a subpatch.
6. Allow the use of AGPL-licensed components and libraries without making the Patchies core AGPL, so the Patchies core can be adopted in projects using any license.
8. Allow you to dynamically define new object types within a patch, e.g. `p.objects.define(GlslObject)`

The vision is that to add new objects to patchies, you'd create a new module in the `modules` directory, or publish it as an NPM package:

```
ui/
modules/
  hydra/
  strudel/
    LICENSE.md
```

This keeps the core engine lightweight, preferably with a bundle size goal (e.g. under 30KB).

## Motivation

I wanted Patchies to be a modular system that lets you run multiple libraries in a virtual machine of sorts, as a way to bridge together different paradigms. Imagine running Uxn/Tal emulators that can send messages to Csound. You can do all sort of experiments on the web.

Also, the code quality as it stands is pretty bad. There are zero tests, neither unit tests nor e2e. By doing a gradular refactoring, we can start writing tests for those small services (e.g. tests for defining objects)

## Approach - Start small

Instead of doing a big refactoring that has a high risk of breaking everything, we will start small first, by making a simple API that lets you define a new textual object e.g. `p.objects.define`. Then we start gradually moving objects from the current implementation to the new modular architecture.

Again, the emphasis is not to break existing code, but add an additional layer on top of the code.

## Milestones

1. Can define a new no-op object e.g. `p.objects.define(VoidObject)`
2. Can define inlets and outlets on objects
3. Can make objects that responds to messages (i.e. sends and receives messages)

More milestones to be added soon.

## API: Patcher

The patcher global object, `patcher`, contains a couple of services under its namespace, e.g.

```ts
let p = patcher

p.objects // ObjectService.
p.video // VideoService
p.audio // AudioService
```

You can use the namespaced service objects to interact with the patcher.

## API: Services

The patcher shall exposes a set of _services_ which are used to manage the patcher's functionality:

- **Objects**: defines new objects and create, update and destroy objects in the patcher.
  - Messaging: listens to messages and sending messages between objects.
  - Svelte: associate a svelte view component with an object, to use in place of the default text object view.
- **Video**: defines new video nodes in the render graph for rendering video frames.
- **Audio**: defines new audio nodes in the audio graph for processing audio frames.
  - **Audio Scheduler**: schedules audio events in the future
- **MIDI**: listens to MIDI events and send MIDI messages
- **Audio Analysis**: runs fft analysis on audio sources

## API: Define a new object

This defines a `void` text object that does nothing:

```ts
class Void {
  static name = "void"
}

p.objects.define(Void)
```

In this case, only the static `name` propery is defined.

## API: Define an object that sends and receives messages

This defines a `delay` text object that delays messages via the `delay` parameter:

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

  async onMessage(data, meta) {
    await sleep(this.params.delay)
    this.send({type: "bang"})
  }
}

p.objects.define(Delay)
```

When messages are sent to the typed inlets e.g. `{ type: 'float' }`, it gets stored in `this.params`.

If the object extends `PatchObject`, it has a couple of useful methods:

- `this.params.delay` - contains the latest valid value of `delay` received by at inlet
- `this.send(data, meta)` - sends a message to the outlet
- `async onMessage(data, meta)` - receives messages from any inlet

## Example: Define a `mtof` object

Define a `mtof` text object that converts MIDI note numbers to frequencies:

```ts
class MtofObject extends PatchObject {
  static name = 'mtof'
  static inlets = [{name: 'note', type: 'float'}]
  static outlets = [{name: 'frequency', type: 'float'}]

  onMessage(note) {
    this.send(Math.pow(2, (note - 69) / 12) * 440)
  }
}

p.objects.define(MtofObject)
```

## API: Using Svelte view components

If the `viewComponent` is defined and it is a valid Svelte component, the object will render with the provided view component. It will pass a couple of standard props to the component.

We recommend writing your view components in Svelte to make full use of Svelte Flow.

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

The `GLSLView` should be a valid Svelte component that receives a couple of props:

```svelte
<script lang="ts">
  let previewCtx
  
  const { video } = getPatcher()

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

## API: using non-Svelte view libraries

It should be possible to not use Svelte for your view components. You can define the `getView(): Element` method to render a DOM element instead.

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

## API: Define a video node

A video node lets you:

1) receive video inputs from other nodes , and
2) emit video outputs to other nodes.

The following registers the `glsl` video node in the video graph.

```ts
class GlslNode {
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

p.video.define(GlslNode)
```

These APIs let you alter the rendering graph:

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

## API: Define an audio node

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
p.audio.createNode('node-id', parameters)
p.audio.removeNode('node-id')

// send message to an audio node
p.audio.send('node-id', key, message)

// update edges
p.audio.updateEdges(edges)

// output gain
p.audio.setOutputGain(value)
p.audio.getOutputGain()
```
