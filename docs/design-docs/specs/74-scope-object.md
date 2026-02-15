# 74. Scope Object

## Overview

`scope~` is an oscilloscope display node that visualizes audio waveforms in real-time. It accepts one audio inlet and renders the waveform on a canvas, similar to Pd ELSE's scope~ object.

## Architecture

- **Processor** (`scope.processor.ts`): AudioWorklet via `defineDSP` with rising zero-crossing trigger detection. Captures 512-sample buffers aligned to trigger points for stable waveform display. Falls back to untriggered capture after 4096 samples.
- **V2 Audio Node** (`ScopeAudioNode.ts`): Custom node that intercepts port messages from the processor and stores the latest waveform buffer.
- **Svelte Component** (`ScopeNode.svelte`): Canvas-based rendering (160x100px) with `requestAnimationFrame` loop reading from the audio node's buffer.

## Trigger Detection

The processor scans for rising zero-crossings (previous sample <= 0, current sample > 0) to align the captured buffer to the start of a waveform cycle. This prevents the display from drifting for periodic signals. A fallback forces capture after 4096 samples without a trigger (handles noise, DC, very low frequencies).
