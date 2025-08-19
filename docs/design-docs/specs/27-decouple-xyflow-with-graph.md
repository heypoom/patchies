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

**✅ COMPLETED**: The `Patcher` class now extends XYFlow's `Node[]` and `Edge[]` types directly to maintain all properties including position, width, height. This eliminates the need for type conversion and keeps the API clean.

**✅ COMPLETED**: Implemented the following core features:

1. **Headless Patcher Class** (`ui/src/lib/core/Patcher.ts`):
   - Uses XYFlow `Node` and `Edge` types directly as `PatcherNode` and `PatcherEdge`
   - Manages graph state with `Map<string, Node>` for nodes and `Map<string, Edge>` for edges
   - Integrates with all existing systems (MessageSystem, AudioSystem, GLSystem, etc.)
   - Provides the public API: `setAudioOutput()`, `setVideoOutput()`, `sendMessage()`, etc.

2. **Global Store** (`ui/src/stores/patcher.store.ts`):
   - Singleton Patcher instance accessible across components
   - `getPatcher()`, `setPatcher()`, `destroyPatcher()` functions

3. **XYFlow Integration** (`ui/src/lib/components/FlowCanvasInner.svelte`):
   - XYFlow state syncs with Patcher via `$effect()` reactive updates
   - Patcher becomes source of truth for all systems
   - Autosave uses Patcher data instead of XYFlow state directly

4. **Public API Export** (`ui/src/lib/index.ts`):
   - Exports `Patcher` class and types for external headless usage
   - Enables `import {Patcher} from '@patchies/headless'` pattern

At this stage, there is seamless synchronization between XYFlow and Patcher state. The XYFlow UI remains fully functional while the Patcher handles all system integration. Once we implement sub-patching, XYFlow will only show one level of the patch hierarchy while Patcher manages the complete graph.
