# 162. Visible Audio Input Ports

Programmable audio objects should not show blue input handles when the current code does not use incoming audio. The internal audio input stays available for nodes that support it, but the xyflow handle can be hidden to reduce visual noise.

## Scope

- `dsp~`: `setAudioPortCount(0, n)` hides audio input handles while keeping the DSP node implementation unchanged.
- `tone~`, `sonic~`, and `elem~`: user code can call `noAudioInput()` to hide the fixed audio input handle. This affects only the visible handle; `inputNode` remains available internally.
- `chuck~`: the audio input handle is visible only when the code references `adc`.
- Defaults and built-in presets that only synthesize or react to messages should opt out of visible audio input handles.

## Data Flow

`tone~`, `sonic~`, and `elem~` store `showAudioInput` in node data. The shared layout uses that value when present, and otherwise derives an initial value from code that contains `noAudioInput()`. Runtime calls update node data after code runs.

`chuck~` derives visibility directly from the current ChucK expression. Its message inlet keeps its existing handle id, so existing control connections stay compatible even when the audio inlet is hidden.

## Testing

Add pure helper tests for code-derived visibility. Run the focused test first, then run Svelte check after implementation.
