# 162. Visible Audio Input Ports

Programmable audio objects should not show blue input handles when the current code does not use incoming audio. The internal audio input stays available for nodes that support it, but the xyflow handle can be hidden to reduce visual noise.

## Scope

- `dsp~`: `setAudioPortCount(0, n)` hides audio input handles while keeping the DSP node implementation unchanged.
- `tone~`, `sonic~`, and `elem~`: hide the fixed audio input handle by default. The handle is shown automatically when code references common audio-input patterns, or explicitly when user code calls `showAudioInput()`. This affects only the visible handle; `inputNode` remains available internally.
- `chuck~`: the audio input handle is visible only when the code references `adc`.
- Defaults and built-in presets that only synthesize or react to messages should not show visible audio input handles.

## Data Flow

`tone~`, `sonic~`, and `elem~` store `showAudioInput` in node data. Each node wrapper derives an initial value from saved data or code on mount, then derives it again only when the user runs code. The shared layout reads the stored boolean without scanning code during render. Runtime `showAudioInput()` calls can still show the inlet after code executes when automatic detection misses indirect input routing.

Automatic detection looks for `inputNode` in `tone~`, `sonic~`, and `elem~` code. `elem~` also treats `el.in(...)` as audio input usage. Detection ignores JavaScript comments and strings.

`chuck~` derives visibility directly from the current ChucK expression. Its message inlet keeps its existing handle id, so existing control connections stay compatible even when the audio inlet is hidden.

## Testing

Add pure helper tests for code-derived visibility. Run the focused test first, then run Svelte check after implementation.
