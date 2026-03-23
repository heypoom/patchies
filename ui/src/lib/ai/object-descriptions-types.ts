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
  * Analysis: fft~ (FFT spectrum analyzer)
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
- canvas: HTML5 Canvas on web worker. no mouse/keyboard, highest performance. can chain into the rendering pipeline at high speed (e.g. video texture for glsl/hydra)
- hydra: Live coding video synthesis with Hydra
- glsl: GLSL fragment shaders for visual effects
- three: Three.js 3D graphics (offscreen worker, for video chaining)
- three.dom: Three.js 3D graphics (main thread, for mouse/keyboard interaction)
- projmap: Projection mapper — warp video textures onto N-point polygon surfaces with built-in point editor and expand mode
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
- stack: LIFO stack — push messages to inlet 0, bang inlet 1 to pop; also accepts clear and size commands on inlet 1
- queue: FIFO queue — push messages to inlet 0, bang inlet 1 to dequeue; also accepts clear and size commands on inlet 1
- wgpu.compute: WebGPU compute shaders (WGSL) for parallel data processing
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
