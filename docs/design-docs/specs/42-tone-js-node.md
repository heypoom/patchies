# 42. tone~ (Tone.js object)

I want to create a `tone~` object that uses [Tone.js](https://tonejs.github.io/) for audio synthesis and processing.

This object should allow users to create complex audio effects and instruments using the powerful features of Tone.js, while still being able to patch it with other audio and message objects in Patchies.

UI-wise, I think it should look similar to the existing `dsp~` object, with a code editor for writing Tone.js code, and input/output audio jacks for connecting to other audio objects.

## Integrations

- We need to use the audioContext from AudioSystem.
  - Good: `Tone.setContext(audioContext)` where `audioContext` is from `AudioSystem.audioContext`.
- Tone.js usually outputs to destination with `.toDestination()`. We need to route all audio to the gain node of the `tone~` object. This is so it can be patched with other audio objects.
  - Bad: `synth.toDestination()`
  - Good: `synth.connect(outputNode)` where `outputNode` is the gain node of the `tone~` object.
- It should support basic message passing functions: `send()`, `recv()` and `setPortCount()` similar to `dsp~`.

## Other nodes of similar nature

Take a look at these to see how they are implemented:

- `dsp~`: Basic Web Audio API object for custom audio synthesis and processing.
- `strudel`: TidalCycles-like music environment for pattern-based music creation.
- `expr~`: Expression-based audio synthesis and processing.
