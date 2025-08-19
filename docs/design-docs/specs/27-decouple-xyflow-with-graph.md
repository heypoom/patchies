# 27. Decouple XYFlow nodes with effects

## High-level Goal

We want to implement sub-patching and external abstractions soon, to allow nesting patches within patches, and using patches in other patches.

This means that we can no longer use the XYFlow nodes and edges as the source of truth, as the visible nodes and edges will only be a subset of the actual nodes and edges that are running in the patch.

For example, systems that has to be sub-patchable are:

- Messaging (using the `MessageSystem`)
- Shader Graph (using the `renderWorker` and `fboRenderer`)
- Audio Graph (using the `AudioSystem`)

## Headless Patcher

We will allow people to be able to run and interact with the entire patcher headlessly by exporting the `Patcher` class, which means that we could only output the final preview image and the final audio output.

For example:

```ts
import {Patcher} from '@patchies/headless'

const patch = new Patcher(patchData)

// sets the final gain node that outputs to audio.
patch.setAudioOutput(gainNode) // GainNode

// sets the rendering context or canvas that renders the full output.
patch.setVideoOutput(canvas) // ImageBitmapRenderingContext | HTMLCanvasElement | OffscreenCanvas

// sets the rendering context or canvas that renders the node preview.
// assigns glSystem.previewCanvasContexts internally, see GLSLCanvasNode.svelte
patch.setVideoPreviewOutput(nodeId, canvas) // ImageBitmapRenderingContext | HTMLCanvasElement | OffscreenCanvas

// send a message to a node by id and inlet index.
patch.sendMessage({nodeId: 'glsl-0', inlet: 2, message: 15})

// future: send a message to a node by named channels,
// either by a `recv` node or by JavaScript.
patch.sendMessage({channel: 'fft-bin-size', message: 15})

// add and remove message listeners.
patch.addMessageListener(nodeId, callback) // string, MessageCallbackFn
patch.removeMessageListener(nodeId, callback) // string, MessageCallbackFn
```

We must use this API ourselves internally in the Svelte Flow node components. Make sure to keep these APIs clean as it will be public-facing.

## Implementation

As a first step, we must decouple the UI logic from the headless graph logic. Create a headless `Patcher` class that handles the graph logic.

The patcher class should be hooked up to every other systems: `MessageSystem`, `AudioSystem`, `AudioAnalysisSystem`, `GLSystem`, `MIDISystem`, `PyodideSystem`.

It should try to replicate the structure of nodes and edges of XYFlow. See the `Node[]` and `Edge[]` types of XYFlow. The only difference is that we do not need UI-related node properties like `x`, `y`, `width`, `height`, `selected`, etc.

At this stage, there will be total duplication of state for XYFlow and Patcher. That is fine. Once we have the sub-patching system and abstraction system, the XYFlow will only be a subset of the patch, as we can only show one level of patch on screen at once.
