# 12. Audio Analysis for Visualizations

We now have the `strudel` object which generates sounds. We also have many visualization objects like `p5`, `hydra`, `js.canvas` and `glsl`. The next step is to connect these two worlds together.

Luckily enough, Hydra and P5.js has built-in audio analysis capabilities:

- P5.js has the `p5.FFT` class which can analyze audio frequencies and amplitudes. See <https://p5js.org/reference/p5.sound/p5.FFT>
- Hydra has [audio reactivity features](https://hydra.ojack.xyz/hydra-docs-v2/docs/learning/sequencing-and-interactivity/audio/#audio-reactivity) built-in, but it only works with a microphone.
  - FFT functionality is available via an audio object accessed via `a.show()` to show the FFT bins. We cannot use that.
  - However, hydra internally uses <https://github.com/meyda/meyda> for audio analysis. We can use Meyda directly in our JS environment to analyze audio and then expose the analysis as a `fft` argument in the JS environment of Hydra.
- Let's focus with `p5` and `hydra` objects for now.
- We should use the Meyda library for audio analysis directly, at least for use in `hydra`.
  - Docs: <https://meyda.js.org/getting-started.html>

When a user connect a `strudel` object to a `p5` or `hydra` object, we want to connect the audio output of the `strudel` object to the video input of the `p5` or `hydra` object. More specifically, we want to extract the audio features from the `strudel` object and pass them to the video objects.

## Audio and Video Routing

We should support explicit routing audio from the `strudel` object to the `p5` or `hydra` object. This is done by using the `VideoHandle`.

I think the `VideoHandle` should also support audio routing. We can rename that sometime in the future.

- If `video -> video` is connected, feed the video output to the video input. This is already implemented.
- If `audio -> video (js)` is connected, feed the extracted audio features to the JS environment of the video input. This is what we want to implement.
- If `audio -> video (glsl)` is connected, we feed in the audio features to the GLSL channel uniform that the user connects (iChannel0-3). This should be compatible with ShaderToy shaders that use audio analysis. This is also what we want to implement as a next step.
- If `video -> audio` is connected -- let's figure this out later. It's very implementation-specific.
