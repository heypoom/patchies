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

- Users should be able to use the visual nodes (e.g. `glsl`, `p5`, `canvas` and `hydra`) to get the audio data.
  - The analysis outlet of the `fft` object is a `marker` type. This means that we must have a custom behavior depending on which node we are connecting.
  - We must keep track of the `analysis` marker outlet of the fft object. We check what nodes that outlet is connected to, then handle them differently.
  - For JavaScript execution contexts, we should provide a consistent `fft()` api that lets them access the audio data. See the `AudioAnalysisProps` type.
    - This is already added to the `MessageContext`, which uses the `AudioAnalysisManager` internally.
  - For P5.js, this already works.
    - We should not always require the user provide the `id` of the analysis object though, as that would be cumbersome.
    - We need to instead track what is the nodeId of the analysis object that the P5.js sketch is connected to. Then, we can use that id to route the audio data correctly.
    - If the `id` is specified, then we still use that object id instead.
  - Luckily, the `ArrayBuffer` is a transferable object, so you can postMessage with `{transfer: [buffer]}` to transfer the ownership of the buffer to the worker.
  - For Hydra and GLSL, the key challenge is that it's running in a web worker context, so we need to transfer the audio data between the main thread and the worker.
  - For Hydra, the `fft` function will work differently than P5.js as they are in a web worker context.
    - We set a variable `isFFTEnabled` in `HydraManager`. This variable is always reset to `false` everytime you re-run the code.
    - When the `fft` function is called in the code (including re-runs), we do two things:
      - We set `isFFTEnabled` to true.
      - We must also communicate back to the main thread that FFT is enabled for a given node.
  - The main thread's analysis manager must keep track on which analyser nodes must be polled
    - We can have a single polling loop that runs 24 times a second.
    - The polling loop should check which nodes have FFT enabled and poll their audio data.
    - It should then forward the audio data to nodes that need it but do not have direct access to the AudioAnalysis node, such as `GLSL` and `Hydra` which are on the web worker rendering thread.
  - For GLSL, we need to send it to the appropriate uniform inlet.
    - The user must define the uniform type as `sampler2D`, i.e. a texture.
    - We will refuse to send the fft data if the user did not connect to a `sampler2D` port.
    - If an `analysis` marker outlet is connected to the `sampler2D` inlet of the GLSL node, we invoke the `AudioAnalysisManager` at slightly lower than the rendering rate (maybe 24 times per second), then set it via `GLSLManager.setBitmapSource`. This will pass the FFT array onto GLSL.
      - We need to add an exception to the connection validation logic, as we are technically connecting a marker outlet to a video inlet which is prohibited.
    - We must not create a new texture on every render. Only create the texture ONCE.
