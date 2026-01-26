/**
 * Object type list for routing purposes (lightweight, no implementation details)
 */
export const OBJECT_TYPE_LIST = `## Basic Control & UI
- button: Send messages on click
- slider: Numeric value control
- toggle: Binary on/off switch
- msg: Send predefined messages
- textbox: Text input and display

## Audio I/O (Dedicated node types)
- dac~: Audio output to speakers/headphones
- mic~: Audio input from microphone

## Audio Objects (Created via "object" node type)
- object: Meta-object for creating text-based audio objects:
  * Processing: gain~, pan~, delay~, compressor~, waveshaper~, split~, merge~, convolver~
  * Filters: lowpass~, highpass~, bandpass~, allpass~, notch~, lowshelf~, highshelf~, peaking~
  * Synthesis: osc~ (oscillator), sig~ (signal)
  * Control: mtof, loadbang, metro, adsr
  * IMPORTANT: Use type "object" with data.expr (e.g., { "type": "object", "data": { "expr": "gain~ 0.5" } })

## Visual & Creative Coding Objects
- vue: write custom user interface and component using Vue.js
- p5: P5.js sketches for interactive graphics and animations
- hydra: Live coding video synthesis with Hydra
- glsl: GLSL fragment shaders for visual effects
- canvas.dom: Interactive HTML5 Canvas with mouse/keyboard input
- canvas: HTML5 Canvas 2D (offscreen, for fast video chaining in rendering pipeline)
- dom: write to the DOM element
- swgl: SwissGL shaders for WebGL2
- bg.out: Background output (final video output)

## Audio & Music Objects
- tone~: Tone.js audio synthesis and processing
- dsp~: Custom DSP with AudioWorklet (JavaScript)
- elem~: Elementary Audio (functional reactive audio)
- sonic~: SuperSonic/SuperCollider synthesis
- chuck~: ChucK audio programming
- csound~: Csound sound and music computing
- strudel: Strudel live coding (TidalCycles)
- orca: Orca livecoding sequencer
- soundfile~: Load and play audio files
- sampler~: Sample playback with triggering
- expr~: Audio-rate mathematical expressions

## Programming & Control Objects
- js: JavaScript code execution
- python: Python code with Pyodide
- expr: Mathematical expression evaluator
- asm: Virtual stack machine assembly
- uxn: Uxn virtual machine (Uxntal)

## Interface & Control Objects
- button: Simple button (sends bang)
- toggle: Boolean toggle switch
- slider: Numerical value slider
- msg: Message sender with predefined values
- textbox: Multi-line text input
- keyboard: Keyboard input controller
- label: Text label for annotations
- link: Clickable link button

## MIDI & Network Objects
- midi.in: MIDI input from devices
- midi.out: MIDI output to devices
- netsend: Network message sender (WebRTC)
- netrecv: Network message receiver (WebRTC)

## Documentation & Content
- markdown: Markdown renderer
- iframe: Embed web content

## Media Input
- webcam: Webcam video input
- screen: Screen capture`;
