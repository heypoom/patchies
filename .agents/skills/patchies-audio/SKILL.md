---
name: patchies-audio
description: Use when adding, migrating, or changing Patchies Audio V2 nodes, native DSP worklet nodes, audio object docs, audio packs, or AudioService integration.
---

# Patchies Audio

## Ownership

Audio object code is object-owned by default. Put new audio node classes, native DSP node wrappers, processors, schemas, components, prompts, and tests under `ui/src/objects/<object-or-family>/` unless the code is truly shared infrastructure.

Shared audio infrastructure belongs in `ui/src/lib/audio/`. The central `ui/src/lib/audio/v2/nodes/index.ts` should mostly stay a registry that imports object-owned node classes and adds them to `AUDIO_NODES`.

## Audio V2

V2 audio nodes are self-contained classes implementing `AudioNodeV2`.

Rules:

- The node name appears once in the static `type` property.
- Prefer node methods and static metadata over `AudioService` branching: `create()`, `send()`, `getAudioParam()`, `connect()`, `connectFrom()`, `destroy()`, `runtimeManaged`, and `getMessageSettingsUpdate`.
- Do not hardcode node types in `AudioService`; add behavior to the node class or interface.
- Async `create()` is supported for nodes that load resources such as AudioWorklets.
- Use `isAudioParam: true` on inlet metadata for modulatable Web Audio or worklet params. `AudioService` uses this metadata for param connections and scheduled messages.

## New Audio Node Checklist

- Create the node class under the owning `ui/src/objects/<module>/`.
- Register it in `ui/src/lib/audio/v2/nodes/index.ts`; generated schemas use this registry.
- Add docs in `ui/static/content/objects/{name}.md`.
- Add it to `ui/src/lib/extensions/object-packs.ts`.
- Add `static aliases = [...]` when aliases exist.
- Add or update object-owned prompt/schema/component files when the object exposes them.
- If adding object docs, also load `docs-style`.

## Native DSP Worklets

Native DSP nodes run on the audio thread via `AudioWorkletProcessor`. Use `createWorkletDspNode` on the main thread and `defineDSP` in the processor.

Prefer this object-local layout:

```text
ui/src/objects/<name~>/
  native-dsp/
    nodes/<name>.node.ts
    processors/<name>.processor.ts
    schemas/<name>.schema.ts  # optional shared port schema
```

Processor pattern:

```ts
import { defineDSP } from '../define-dsp';

defineDSP({
  name: 'mynode~',
  audioInlets: 1,
  audioOutlets: 1,
  inletDefaults: { 1: 0 },
  state: () => ({}),
  recv(state, data, inlet, send) {},
  process(state, inputs, outputs, send, parameters) {}
});
```

Node definition pattern:

```ts
import { createWorkletDspNode } from '../create-worklet-dsp-node';
import workletUrl from '../processors/mynode.processor?worker&url';

export const MyNode = createWorkletDspNode({
  type: 'mynode~',
  group: 'processors',
  description: '...',
  workletUrl,
  audioInlets: 1,
  audioOutlets: 1,
  inlets: [{ name: 'signal', type: 'signal', description: '...' }],
  outlets: [{ name: 'out', type: 'signal', description: '...' }],
  tags: ['audio']
});
```

For nodes with AudioParams or larger port metadata, define a shared `DspPortSchema` and spread it into the node config. Pass the same schema to `defineDSP()` when the processor needs generated AudioParam descriptors:

```ts
export const ClipPortSchema: DspPortSchema = {
  inlets: [
    { name: 'signal', type: 'signal', description: 'Audio input' },
    {
      name: 'min',
      type: 'float',
      description: 'Minimum value',
      defaultValue: -1,
      isAudioParam: true,
      messages: [{ schema: Type.Number(), description: 'Minimum clamp value' }]
    }
  ],
  outlets: [{ name: 'out', type: 'signal', description: 'Output' }]
};
```

Register native DSP nodes the same way as other V2 audio nodes.

Inlet types: `signal`, `message`, `float`, `bang`, `string`.

Useful inlet metadata:

- `acceptsFloat: true` on a signal inlet lets creation args or float messages set the disconnected constant value.
- `controlsSignalInlet` routes a hidden float/control inlet to a signal inlet's constant value.
- `hideInlet: true` hides an inlet handle while keeping the parameter available.
- `hideTextParam: true` hides a parameter from the object label.
- `schemaInlets` lets docs/generated schemas show a different public inlet list than the runtime worklet config.
- `audioParamAutomationRate` configures `a-rate`/`k-rate` params when `isAudioParam` is true.

Reference nodes:

- `wrap~` for the simplest processor.
- `clip~` for float inlets.
- `snapshot~` for bang plus message output.
- `line~` for command messages.
- `+~`, `*~`, and other audio math nodes for `acceptsFloat`.
- `samphold~` for multiple signals plus a message inlet.
- `tap~` for `runtimeManaged`, `schemaInlets`, and `getMessageSettingsUpdate`.

Gotchas:

- Signal inlets cannot receive control messages. Add a separate message inlet when a node needs commands.
- Do not document message schemas in markdown files. The node definition is the single source of truth.
- If a visible signal inlet should accept float constants, prefer `acceptsFloat`. Use `controlsSignalInlet` plus `hideInlet` only when a separate hidden control inlet is actually needed.
