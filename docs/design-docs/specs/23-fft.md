# 23. Audio Analysis via FFT

We want to create a system for audio analysis, for two reasons:

1. To let people create visualizations that react to audio.
2. To let people inspect the waveforms and audio content.

## Goals

- Create an audio analysis system that integrates with the `AudioSystem.ts` that we have.
- We should be able to have multiple `AudioAnalyser` within the same node.
- Users should be able to place **analyzer objects** anywhere in the graph.

  - The object is called `fft` and lives in `object-definitions.ts`
  - In the `AudioSystem`, this creates a new `fft` audio node.
  - This lets them create custom audio visualizations by using the data from audio analyzed in real-time.

- Users should be able to use the visual nodes (e.g. `glsl`, `p5` and `hydra`) to get the audio data.
  - For JavaScript execution contexts, we provide the `fft()` api that lets them access the audio data. See the `AudioAnalysisProps` type.
  - For Hydra and GLSL, the key challenge is that it's running in a web worker context, so we need to transfer the audio data between the main thread and the worker.
  - For GLSL, we need to send it to the appropriate uniform inlet.
  - Luckily, the `ArrayBuffer` is a transferable object, so you can postMessage with `{transfer: [buffer]}` to transfer the ownership of the buffer to the worker.
