# 34. Convolver

Let's add a `convolver~` node. This uses the `ConvolverNode`.

Inlets:

- message: used to receive the `AudioBuffer` for the impulse response. on message `P.instanceOf(AudioBuffer)` set that as `ConvolverNode.buffer`. A mono, stereo, or 4-channel AudioBuffer containing the (possibly multichannel) impulse response used by the ConvolverNode to create the reverb effect.
- normalize: A boolean that controls whether the impulse response from the buffer will be scaled by an equal-power normalization when the buffer attribute is set, or not.

## Where to update

- AudioSystem.ts
- object-definitions.ts
