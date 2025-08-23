# 27. Decouple XYFlow nodes with effects

## High-level Goal

We want to implement sub-patching and external abstractions soon, to allow nesting patches within patches, and using patches in other patches.

This means that we can no longer use the XYFlow nodes and edges as the source of truth, as the visible nodes and edges will only be a subset of the actual nodes and edges that are running in the patch.

For example, systems that has to be sub-patchable are:

- Messaging (using the `MessageSystem`)
- Shader Graph (using the `renderWorker` and `fboRenderer`)
- Audio Graph (using the `AudioSystem`)

## Headless Patcher

We will allow people to be able to run and interact with the entire patcher headlessly by exporting the public-facing `Patcher` class, which means that we could only output the final preview image and the final audio output.

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

## Data Structure

Use the `Node[]` and `Edge[]` types directly.

At this stage, the state stored in the Patcher class and in the XYFlow node will be 100% duplicated. That is fine.

Once we have the sub-patching system and abstraction system, the XYFlow shown on screen may only be a subset of the patch, as we can only show one level of patch on screen at once.

## Future: patches in patches

Creating a new sub-patch can be done by adding a `patcher` object, or `p` for short.

- `p` creates an empty patcher.
- `p name` creates an empty named patcher.
- `p https://...` loads a remote patch from a given url.
- future: `p @foo/bar` loads a remote patch from a repository.

Internally, the patcher object has this normalized representation. This normalization is to make multiple source types of including patches possible, such as sub-patches (directly embedded into the patch file), and externals (can be loaded by url).

```tsx
type PatcherNodeData = {
  // where should we load this patch?
  source: PatcherSource
}

type PatcherSource =
  | {type: 'local'; id: string, name?: string}
  | {type: 'url'; url: string}
  | {...}
```

Here are the available patcher sources:

- `local` patches are directly included in the main patcher's save file.
  - this is stored in the `patches: Record<string, Patch>` JSON field of the save file.
  - this is also an optimization to avoid the XYFlow nodes and edges object being too bloated with data from sub-patches. it's lighter if it only stores the references to
  - Dragging in a JSON patch file into a patch adds it as a local patch.
- `url` loads the patch by url.
  - this can be helpful for scenarios like loading from libraries.
  - e.g. you can load from GitHub or your S3 bucket
- future: `repo` loads the patch from a Patchies server, for use cases like having patch libraries.
  - the current Patchies server is always used as the default repository.
  - `p @foo/bar` loads the patch named `bar` from the namespace `foo`
  - `p @foo/bar/baz` loads the patch `baz` from the namespace `@foo/bar`
  - if the user does not have a patchies server, it defaults

The patcher class contains `patches: Record<number, Patch>`, which contains both externally loaded as well as locally loaded patches. The `Patch` contains the full `nodes` and `edges` and other metadata.

## Future: defining inlets and outlets

The patcher will have `in` and `out` nodes that allows patches to expose inlets and outlets, which can be both named and typed, so they can be used in other patches.

This will require a fair bit of work, as there is multiple types of inlets and outlets that a user can expose:

- Video (orange)
- Audio Signal (blue)
- Message (white)

We can cache the inlets and outlets on patch load, and use that data to render the main patch.
