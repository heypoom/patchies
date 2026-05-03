/**
 * Object type list for routing purposes (lightweight, no implementation details)
 */
export const OBJECT_TYPE_LIST = `## Basic Control & UI
- button: Send messages on click
- slider: Numeric value control
- toggle: Binary on/off switch
- msg: Send predefined messages
- textbox: Text input and display
- curve: Breakpoint curve editor

## Audio I/O (Dedicated node types)
- mic~: Audio input from microphone
- out~: Audio output to speakers/headphones
- meter~: Visual audio level meter
- scope~: Oscilloscope display for audio signals
- soundfile~: Load and play audio files
- sampler~: Sample playback with triggering
- pads~: 16-pad drum sampler triggered by MIDI noteOn/noteOff (GM drum map, note 36 = pad 1)
- split~: Split multi-channel audio into separate mono channels.
- merge~: Merge multiple mono channels into a single multi-channel audio.

## Audio Objects (Created via "object" node type)
- object: Meta-object for creating text-based audio objects:
  * Processing: gain~, pan~, delay~, compressor~, waveshaper~, convolver~, expr~, fexpr~
  * Filters: lowpass~, highpass~, bandpass~, allpass~, notch~, lowshelf~, highshelf~, peaking~, biquad~, vcf~, comb~
  * Synthesis: osc~ (oscillator), sig~ (signal), noise~, pink~, phasor~, pulse~
  * Envelopes & Control: adsr~, line~, vline~, env~, snapshot~, latch~, samphold~, slop~, threshold~
  * Math (audio-rate): +~, -~, *~, /~, >~, <~, abs~, cos~, exp~, log~, sqrt~, rsqrt~, pow~, min~, max~, wrap~, clip~
  * Conversion: mtof~ (MIDI to frequency), ftom~ (frequency to MIDI)
  * Table: tabosc4~, tabread~, tabread4~, tabwrite~
  * Delay lines: delwrite~ (write to named delay), delread~ (read from named delay), delread4~ (interpolating read)
  * Timing: beat~ (fire on beat subdivisions), bang~ (convert signal bang to message bang)
  * Routing: send (send messages to a named channel), recv (receive messages from a named channel), send~, recv~ (wireless audio routing)
  * Utility: bang, float, metro, loadbang, samplerate~, mtof (message-rate)
  * Analysis: fft~ (FFT spectrum analyzer), tap~ (capture trigger-synced audio frames as messages)
  * IMPORTANT: Use type "object" with data containing THREE fields: expr (full string), name (first word only), params (array of values matching arguments)
  * data format: { "expr": "name arg1 arg2", "name": "name", "params": [arg1, arg2] }
  * Examples:
  *   no args:   { "expr": "out~",        "name": "out~",       "params": [] }
  *   one arg:   { "expr": "gain~ 0.5",   "name": "gain~",      "params": [0.5] }
  *   two args:  { "expr": "delay~ 500",  "name": "delay~",     "params": [500] }
  *   string:    { "expr": "osc~ sine",   "name": "osc~",       "params": ["sine"] }

## Visual & Creative Coding Objects
- vue: write custom user interface and component using Vue.js
- p5: P5.js. readable code, great for shorter interactive sketches with mouse/keyboard via p5's API
- canvas.dom: HTML5 Canvas on main thread. supports mouse/keyboard, lower overhead than p5, best for heavy visuals needing interactivity
- surface: Fullscreen interactive canvas overlay. captures mouse/touch input across the entire screen. use for live performance drawing, painting, or touch interaction.
- canvas: HTML5 Canvas on web worker. no mouse/keyboard, highest performance. can chain into the rendering pipeline at high speed (e.g. video texture for glsl/hydra)
- hydra: Live coding video synthesis with Hydra
- glsl: GLSL fragment shaders for visual effects
- three: Three.js 3D graphics (offscreen worker, for video chaining)
- regl: GPU renderer with regl draw commands (custom vertices, buffers, multi-pass, blend modes)
- three.dom: Three.js 3D graphics (main thread, for mouse/keyboard interaction)
- projmap: Projection mapper — warp video textures onto N-point polygon surfaces with built-in point editor and expand mode
- dom: write to the DOM element
- swgl: do not use unless explicitly requested
- bg.out: Background output (final video output)

## Audio & Music Objects
- tone~: Tone.js audio synthesis and processing
- dsp~: Custom DSP with AudioWorklet (JavaScript)
- elem~: Elementary Audio (functional reactive audio)
- sonic~: SuperSonic/SuperCollider synthesis
- chuck~: ChucK audio programming
- csound~: Csound sound and music computing
- bytebeat~: Bytebeat algorithmic synthesis with t-based expressions
- strudel: Strudel live coding (TidalCycles)
- orca: Orca livecoding sequencer
- expr~: Audio-rate mathematical expressions

## Programming & Control Objects
- js: JavaScript code execution
- worker: JavaScript in Web Worker thread (non-blocking)
- ruby: Ruby code with ruby.wasm
- python: Python code with Pyodide
- expr: Mathematical expression evaluator
- clip: Clamp a number to a min/max range (clip min max)
- pack: Collect float, symbol, and any inlet values into one list (pack f s a, pack 0 symbol any)
- unpack: Split an array into individual element outlets
- stack: LIFO stack — push messages to inlet 0, bang inlet 1 to pop; also accepts clear and size commands on inlet 1
- queue: FIFO queue — push messages to inlet 0, bang inlet 1 to dequeue; also accepts clear and size commands on inlet 1
- wgpu.compute: WebGPU compute shaders (WGSL) for parallel data processing
- asm: Virtual stack machine assembly (can send/receive messages)
- uxn: Uxn virtual machine (Uxntal, visual & interactive)

## Interface & Control Objects
- button: Simple button (sends bang)
- toggle: Boolean toggle switch
- slider: Numerical value slider
- msg: Message sender with predefined values
- textbox: Multi-line text input
- keyboard: Keyboard input controller
- label: Text label for annotations
- link: Clickable link button
- sequencer: Multi-track step sequencer synced to transport clock (drum machine style; one outlet per track)

## MIDI & Network Objects
- midi.in: MIDI input from devices
- midi.out: MIDI output to devices
- netsend: Network message sender (WebRTC)
- netrecv: Network message receiver (WebRTC)
- serial: WebSerial port — send/receive strings, Uint8Array, or number[] to hardware devices (Arduino, etc.)
- serial.term: Interactive serial terminal with scrollback, ANSI colors, and command history
- serial.dmx: DMX-512 lighting output over serial (250kbaud/8N2, hardcoded) — send number[] or Uint8Array of up to 512 channel values

## Documentation & Content
- markdown: Markdown renderer
- iframe: Embed web content

## AI Objects
- ai.stt: Transcribe speech to text using Gemini AI (send listen to start, stop to finish)
- stt: Transcribe speech to text using browser Web Speech API (no API key, send listen to start, stop to finish)

## Media Input
- webcam: Webcam video input
- screen: Screen capture
- vdo.ninja.pull: Receive audio from a VDO.Ninja stream (WebRTC)
- vdo.ninja.push: Send audio to a VDO.Ninja stream (WebRTC)

## Video Routing
- send.vdo: Send video frames to a named channel (wireless video routing)
- recv.vdo: Receive video frames from a named channel (wireless video routing)

## Vision ML (MediaPipe)
- vision.hand: Real-time hand skeleton detection — emits { hands: [{handedness, score, landmarks, worldLandmarks}], timestamp }
- vision.body: Full-body pose estimation — emits { poses: [{landmarks, worldLandmarks}], timestamp }
- vision.face: Facial landmark detection (478 points) — emits { faces: [{landmarks, blendshapes?}], timestamp }
- vision.segment: Body segmentation mask — video outlet (greyscale mask bitmap), optional message outlet with raw mask data
- vision.detect: Object detection with bounding boxes — emits { detections: [{label, score, boundingBox}], timestamp }
- vision.gesture: Gesture recognition — emits { gestures: [{gesture, score, handedness, landmarks, worldLandmarks}], timestamp }
- vision.classify: Image classification (EfficientNet Lite0, 1000 ImageNet classes) — emits { classifications: [{label, score}], timestamp }`;

/**
 * Compact object list for Sparks idea generation — names + brief purpose, no implementation detail.
 */
export const SPARKS_OBJECT_LIST = `## Visuals
- p5: P5.js sketches — generative drawing, particle systems, interactive 2D graphics
- canvas: High-performance HTML5 canvas (web worker) — great for heavy visual pipelines
- surface: Fullscreen interactive canvas — capture mouse/touch across entire screen for drawing/painting
- hydra: Live video synthesis — feedback loops, texture blending, webcam warping
- glsl: GLSL fragment shaders — pixel-level visual effects, raymarching, procedural textures
- three: Three.js 3D graphics (offscreen worker) — meshes, lighting, cameras, 3D scenes; for video chaining
- three.dom: Three.js 3D graphics (main thread) — same as three but supports mouse/keyboard interaction
- regl: Low-level GPU rendering — custom vertices, multi-pass, blend modes
- canvas.dom: HTML5 Canvas (main thread) — supports mouse/keyboard, lower overhead than p5
- projmap: Projection mapping — warp video onto surfaces with a built-in point editor
- textmode: Text-based "shader" rendering — create visuals with ASCII characters
- vue: Custom UI with Vue.js — reactive components, sliders, panels, dashboards
- dom: Write raw HTML/CSS to a DOM element — flexible UI without a framework

## Audio Synthesis
- strudel: TidalCycles-style live coding — pattern-based music, polymeter, mini-notation
- tone~: Tone.js — high-level synthesis, effects chains, scheduling, instruments
- orca: Esoteric livecoding sequencer — 2D grid of operators that fire MIDI/messages
- bytebeat~: One-expression algorithmic audio — t-based math formulas that generate sound
- csound~: Csound — classic computer music language with thousands of opcodes
- chuck~: ChucK — strongly-timed audio programming language
- sonic~: SuperCollider-style synthesis — rich synthesis engine

## Signal Processors
- dsp~: Custom DSP with AudioWorklet — write your own sample-level processing in JS
- elem~: Functional reactive audio with Elementary Audio
- expr~: Audio-rate mathematical expressions — inline formula on the signal path
- snapshot~: Sample an audio signal on demand (bang → current value)
- samphold~: Sample-and-hold — freeze a signal when triggered
- env~: Envelope follower — tracks the amplitude of an audio signal
- latch~: Hold a signal value until retriggered

## Audio Processing
- gain~, pan~: Volume and stereo panning
- delay~: Echo and delay lines
- convolver~: Convolution reverb
- lowpass~, highpass~, bandpass~, vcf~: Filters
- compressor~: Dynamic range compression
- waveshaper~: Wavefold and distortion
- comb~: Comb filter — metallic resonance, Karplus-Strong-style sounds
- adsr~: Attack-decay-sustain-release envelope

## Audio Analysis
- fft~: FFT spectrum analyzer — frequency bands drive visuals or routing
- scope~: Oscilloscope — visualise waveforms in real time
- meter~: Audio level meter

## Audio I/O
- mic~: Microphone input
- soundfile~: Load and play audio files
- sampler~: Sample playback with pitch and trigger control
- pads~: 16-pad drum sampler (GM drum map)

## MIDI
- midi.in, midi.out: MIDI controller input/output

# Serial
- serial: WebSerial — communicate with Arduino, sensors, any serial device
- serial.term: Interactive serial terminal — scrollback, ANSI colors, command history
- serial.dmx: DMX-512 lighting output — send up to 512 channel values to DMX fixtures

## Network & Streaming
- netsend, netrecv: WebRTC message send/receive between peers
- vdo.ninja.pull: Receive audio from a VDO.Ninja stream (WebRTC)
- vdo.ninja.push: Send audio to a VDO.Ninja stream (WebRTC)

# Video Input
- webcam: Live webcam video input
- screen: Screen capture input

## Vision
- vision.hand: Real-time hand skeleton tracking (21 landmarks per hand)
- vision.body: Full-body pose estimation (33 body landmarks)
- vision.face: Facial landmark mesh (478 points, blend shapes)
- vision.gesture: Gesture recognition (thumbs up, peace sign, etc.)
- vision.detect: Object detection with bounding boxes (1000 classes)
- vision.segment: Body segmentation — separate person from background as a mask
- vision.classify: Image classification — 1000 ImageNet classes with confidence scores

## Low-Level
- asm: Virtual stack machine assembly — minimalist bytecode VM, send/receive messages
- uxn: Uxn virtual machine — runs Uxntal programs, visual and interactive
- wgpu.compute: WebGPU compute shaders (WGSL) — massively parallel data processing on GPU
- uiua: UIUA stack based virtual machine

## Scripting & Logic
- js: JavaScript — full scripting, access to Patchies API (fft, send, recv, flash, etc.)
- worker: JavaScript in a Web Worker — non-blocking heavy computation
- ruby: Ruby scripting with ruby.wasm
- python: Python scripting with Pyodide — numpy, scipy, ML libraries
- expr: Mathematical expression evaluator — compact formula nodes
- sequencer: Step sequencer synced to transport clock — drum machine style, one outlet per track
- slider, button, toggle, keyboard, textbox, curve: UI controls and display widgets

## Documentation & Embed
- markdown: Render markdown text — patch notes, labels, instructions
- iframe: Embed any web page or tool

## AI & Speech
- ai.stt: Speech-to-text via Gemini AI — send listen/stop to control
- stt: Speech-to-text via browser Web Speech API — no API key needed`;
