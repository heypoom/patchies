# 23. Audio Analysis

We want to create a system for audio analysis, for two reasons:

1. To let people create visualizations that react to audio.
2. To let people inspect the waveforms and audio content.

## Goals

- Create an audio analysis system that integrates with the `AudioSystem.ts` that we have.
- We should be able to have multiple `AudioAnalyser` within the same node.
- Users should be able to use the visual nodes (e.g. `glsl`, `p5` and `hydra`) to
- Stretch Goal: as we have the web audio nodes from Strudel (`strudel`) and LiveMusicManager (`ai.music`), we should ideally be able to visualize them too.

## Analyzer Objects

- Users should be able to place **analyzer objects** anywhere in the graph.

  - This lets them create custom audio visualizations by using the data from audio analyzed in real-time.
  - This should be a visual node with the type of `analyzer~`, created as `AnalyzerNode.svelte`
  - In the `AudioSystem`, this creates a new Analyzer node.
  - This should emit the analyzed audio data as a stream.

## Oscilloscope (Time-Domain)

We want to provide a built-in oscilloscope.

## Spectrogram (Freq-Domain)

We want to provide a built-spectrograms.
