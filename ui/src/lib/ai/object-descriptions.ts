/**
 * Object descriptions and instructions for AI code generation.
 * This file contains all the object-specific details that guide the AI
 * in generating appropriate configurations for each object type.
 */

/**
 * Returns detailed instructions and examples for a specific object type.
 * Used by both single and multi-object generation.
 */
export function getObjectSpecificInstructions(objectType: string): string {
	switch (objectType) {
		case 'tone~':
			return `## tone~ Object Instructions

CRITICAL RULES FOR TONE.JS:
1. NEVER use .toDestination() - always use .connect(outputNode)
2. ALWAYS call setTitle() and setPortCount() at the start
3. To connect audio inlet: inputNode.connect(node.input.input) (mind the double .input)
4. ALWAYS return cleanup object: { cleanup: () => node.dispose() }

HANDLE IDS (Auto-generated):
- Message inlet: "message-in" (for receiving control messages)
- Audio inlet: "audio-in" (if using inputNode)
- Audio outlet: "audio-out" (to send to next audio node like dac~)
- Multiple message inlets: "message-in-0", "message-in-1", etc. (only if setPortCount(n) > 1)

Available in context:
- Tone: the Tone.js library
- inputNode: GainNode for receiving audio input
- outputNode: GainNode for sending audio output (USE THIS, not toDestination!)
- setTitle(name): set the node title
- setPortCount(inlets, outlets): set message port counts
- recv(callback): receive messages
- send(data): send messages

Example - Polyphonic Synth:
\`\`\`json
{
  "type": "tone~",
  "data": {
    "code": "setPortCount(1)\\nsetTitle('synth~')\\n\\nconst synth = new Tone.PolySynth(Tone.Synth, {\\n  oscillator: { type: \\"fatsine\\" },\\n  envelope: { attack: 0.01, release: 0.9 }\\n}).connect(outputNode);\\n\\nrecv(m => {\\n  const now = Tone.now();\\n  if (m.type === 'noteOn') {\\n    const freq = Tone.Frequency(m.note, \\"midi\\").toNote();\\n    synth.triggerAttack(freq, now, m.velocity / 127);\\n  } else if (m.type === 'noteOff') {\\n    const freq = Tone.Frequency(m.note, \\"midi\\").toNote();\\n    synth.triggerRelease(freq, now);\\n  }\\n});\\n\\nreturn { cleanup: () => synth.dispose() };"
  }
}
\`\`\`

Example - Lowpass Filter:
\`\`\`json
{
  "type": "tone~",
  "data": {
    "code": "setPortCount(1)\\nsetTitle('lowpass~')\\n\\nconst filter = new Tone.Filter(5000, \\"lowpass\\")\\ninputNode.connect(filter.input.input)\\nfilter.connect(outputNode)\\n\\nrecv(m => {\\n  filter.frequency.value = m;\\n})\\n\\nreturn { cleanup: () => filter.dispose() }"
  }
}
\`\`\``;

		case 'dsp~':
			return `## dsp~ Object Instructions

CRITICAL RULES:
1. MUST implement process(inputs, outputs) function
2. ALWAYS call setTitle(), setPortCount(), setAudioPortCount() at start
3. Access audio buffers via inputs[inputIndex][channelIndex] and outputs[outputIndex][channelIndex]

HANDLE IDS (Auto-generated):
- Message inlet: "message-in" (for control messages)
- Audio inlets: "audio-in-0", "audio-in-1" (indexed by setAudioPortCount)
- Audio outlets: "audio-out-0", "audio-out-1" (indexed by setAudioPortCount)
- Multiple message inlets: "message-in-0", "message-in-1" (indexed by setPortCount)

Available in context:
- counter: increments every process() call
- sampleRate: audio sample rate (e.g. 48000)
- currentFrame: current frame number
- currentTime: current time in seconds
- $1-$9: dynamic value inlets
- setTitle(name), setPortCount(inlets, outlets), setAudioPortCount(inlets, outlets)
- setKeepAlive(enabled), recv(callback), send(data)

Example - White Noise:
\`\`\`json
{
  "type": "dsp~",
  "data": {
    "code": "setTitle('noise~')\\n\\nfunction process(inputs, outputs) {\\n  outputs[0].forEach(channel => {\\n    for (let i = 0; i < channel.length; i++) {\\n      channel[i] = Math.random() * 2 - 1;\\n    }\\n  });\\n}"
  }
}
\`\`\``;

		case 'p5':
			return `## p5 Object Instructions

P5.js creative coding environment. Write standard P5.js code with setup() and draw().

Available functions:
- noDrag(): disable node dragging (use for interactive sketches)
- noOutput(): hide video output port
- setTitle(name): set node title
- send(data), recv(callback): message passing
- fft(): audio analysis (connect fft~ object)

HANDLE IDS (Auto-generated):
- Video outlet: "video-out" (for rendering the p5 sketch)
- Message inlet: "message-in" (for receiving control messages)

Example - Rotating Cube:
\`\`\`json
{
  "type": "p5",
  "data": {
    "code": "function setup() {\\n  createCanvas(400, 400, WEBGL);\\n}\\n\\nfunction draw() {\\n  background(220);\\n  rotateX(frameCount * 0.01);\\n  rotateY(frameCount * 0.01);\\n  box(100);\\n}"
  }
}
\`\`\``;

		case 'hydra':
			return `## hydra Object Instructions

Live coding video synthesis. Use Hydra's chainable functions.

Available functions:
- setVideoCount(inlets, outlets): set video port counts (default 1, 1)
- src(s0), src(s1): access video inputs
- out(o0): set output
- fft(): audio reactivity

Example - Video Mixer:
\`\`\`json
{
  "type": "hydra",
  "data": {
    "code": "setVideoCount(2, 1)\\n\\nsrc(s0)\\n  .blend(src(s1), 0.5)\\n  .out(o0)"
  }
}
\`\`\``;

		case 'glsl':
			return `## glsl Object Instructions

GLSL fragment shader for visual effects. Uses Shadertoy-compatible format.

CRITICAL RULES:
1. MUST use mainImage function signature: void mainImage(out vec4 fragColor, in vec2 fragCoord)
2. Write GLSL code, NOT JavaScript
3. Shaders are Shadertoy-compatible
4. Define custom uniforms for dynamic control

HANDLE IDS (Auto-generated - VERY DYNAMIC):
- Output outlet: "video-out" (always present for shader output)
- Uniform inlets depend on your shader code and are auto-generated:
  * "video-in-{index}-{uniformName}-sampler2D" for texture inputs
  * "message-in-{index}-{uniformName}-float" for float inputs
  * "message-in-{index}-{uniformName}-vec3" for vec3 inputs
  * DO NOT try to connect to specific uniform handle IDs in edges
  * Instead, use GLSL uniform names and let the framework match them
- Examples of uniform declarations that create handles:
  * "uniform float iMix" → creates handle for iMix parameter
  * "uniform sampler2D iChannel0" → creates handle for video input

Built-in uniforms:
- iResolution: vec3 (viewport resolution, z is pixel aspect ratio)
- iTime: float (shader playback time in seconds)
- iMouse: vec4 (mouse pixel coords, xy=current, zw=click)
- iFrame: int (shader playback frame)

Custom uniforms:
- uniform float iMix: creates a float inlet
- uniform vec2 iFoo: creates a vec2 inlet
- uniform sampler2D iChannel0: creates a video inlet (orange)

Example - Solid Red:
\`\`\`json
{
  "type": "glsl",
  "data": {
    "code": "void mainImage(out vec4 fragColor, in vec2 fragCoord) {\\n  fragColor = vec4(1.0, 0.0, 0.0, 1.0);\\n}"
  }
}
\`\`\`

Example - Animated Colors:
\`\`\`json
{
  "type": "glsl",
  "data": {
    "code": "void mainImage(out vec4 fragColor, in vec2 fragCoord) {\\n  vec2 uv = fragCoord / iResolution.xy;\\n  vec3 color = vec3(0.0);\\n  float time = iTime * 0.5;\\n  \\n  color.r = sin(uv.x * 10.0 + time) * 0.5 + 0.5;\\n  color.g = sin(uv.y * 10.0 + time * 1.2) * 0.5 + 0.5;\\n  color.b = sin((uv.x + uv.y) * 5.0 + time * 0.8) * 0.5 + 0.5;\\n  \\n  float brightness = sin(time * 2.0) * 0.2 + 0.8;\\n  color *= brightness;\\n  fragColor = vec4(color, 1.0);\\n}"
  }
}
\`\`\`

Example - With Custom Uniform:
\`\`\`json
{
  "type": "glsl",
  "data": {
    "code": "uniform float iMix;\\n\\nvoid mainImage(out vec4 fragColor, in vec2 fragCoord) {\\n  vec2 uv = fragCoord / iResolution.xy;\\n  vec3 color = mix(vec3(1.0, 0.0, 0.0), vec3(0.0, 0.0, 1.0), iMix);\\n  fragColor = vec4(color * uv.x, 1.0);\\n}"
  }
}
\`\`\`

Example - With Video Input:
\`\`\`json
{
  "type": "glsl",
  "data": {
    "code": "uniform sampler2D iChannel0;\\n\\nvoid mainImage(out vec4 fragColor, in vec2 fragCoord) {\\n  vec2 uv = fragCoord / iResolution.xy;\\n  vec3 tex = texture(iChannel0, uv).rgb;\\n  fragColor = vec4(tex * 1.2, 1.0);\\n}"
  }
}
\`\`\``;

		case 'canvas.dom':
			return `## canvas.dom Object Instructions

Interactive HTML5 Canvas on main thread. Use for mouse/keyboard input and instant FFT reactivity.

CRITICAL RULES:
1. ALWAYS call noDrag() at start if capturing mouse events
2. ALWAYS call noOutput() if no video output needed
3. Use requestAnimationFrame for draw loop

Available:
- ctx: canvas 2D context
- width, height: canvas dimensions
- mouse: {x, y, down, buttons}
- noDrag(), noOutput(), setTitle(), setCanvasSize(w, h)
- setPortCount(inlets, outlets), send(), recv()
- onKeyDown(callback), onKeyUp(callback)
- fft(): instant audio analysis

HANDLE IDS (Auto-generated):
- Message outlet: "message-out" (for sending control data)
- Message inlet: "message-in" (for receiving control messages)
- Note: noOutput() removes the video-out handle

Example - XY Pad:
\`\`\`json
{
  "type": "canvas.dom",
  "data": {
    "code": "noDrag()\\nnoOutput()\\nsetPortCount(0, 1)\\nsetTitle('xy.pad')\\n\\nlet padX = width / 2\\nlet padY = height / 2\\n\\nfunction draw() {\\n  ctx.fillStyle = '#18181b'\\n  ctx.fillRect(0, 0, width, height)\\n\\n  if (mouse.down) {\\n    padX = mouse.x\\n    padY = mouse.y\\n    send([padX / width, padY / height])\\n  }\\n\\n  ctx.fillStyle = mouse.down ? '#4ade80' : '#71717a'\\n  ctx.beginPath()\\n  ctx.arc(padX, padY, 12, 0, Math.PI * 2)\\n  ctx.fill()\\n\\n  requestAnimationFrame(draw)\\n}\\n\\ndraw()"
  }
}
\`\`\``;

		case 'slider':
			return `## slider Object Instructions

Number slider control.

Configuration:
- min: minimum value
- max: maximum value
- defaultValue: initial value
- isFloat: true for floating point, false for integers
- isVertical: true for vertical orientation

HANDLE IDS (Auto-generated):
- Message outlet: "message-out" (sends current slider value)
- Message inlet: "message-in" (receives external value to set slider)

Example - Float Slider 0 to 1:
\`\`\`json
{
  "type": "slider",
  "data": {
    "min": 0,
    "max": 1,
    "defaultValue": 0.5,
    "isFloat": true
  }
}
\`\`\``;

		case 'js':
			return `## js Object Instructions

JavaScript code execution block.

Available functions:
- send(data), recv(callback): message passing
- setPortCount(inlets, outlets): set message port counts
- setRunOnMount(enabled): auto-run on load
- console.log(): logging
- fft(): audio analysis
- esm(moduleName): import NPM packages
- setInterval, requestAnimationFrame (auto-cleanup)

HANDLE IDS (Auto-generated):
- Message inlet: "message-in" (controlled by setPortCount)
- Message outlet: "message-out" (controlled by setPortCount)
- setPortCount(inlets, outlets) controls handle count
- LIMITATION: Cannot have mixed inlet types (all message or all message)

Example - Random Number Generator:
\`\`\`json
{
  "type": "js",
  "data": {
    "code": "setRunOnMount(true)\\nsetPortCount(0, 1)\\n\\nsetInterval(() => {\\n  send(Math.random());\\n}, 1000);"
  }
}
\`\`\``;

		case 'expr':
			return `## expr Object Instructions

Mathematical expression evaluator at control rate. Perfect for parameter mapping and control signals.

CRITICAL RULES:
1. Use $1, $2, ... $9 to create dynamic inlets
2. Each $N variable creates an inlet automatically
3. Result is sent as message when any inlet receives a value
4. Uses expr-eval library - supports full mathematical expression syntax

Available operators and functions:
- Arithmetic: +, -, *, /, ^, %
- Trigonometry: sin(), cos(), tan(), asin(), acos(), atan(), atan2()
- Math: sqrt(), abs(), ceil(), floor(), round(), log(), exp(), min(), max()
- Logic: ==, !=, <, >, <=, >=, and, or, not
- Conditionals: condition ? true_val : false_val
- Constants: PI, E

Multi-line support:
- Use semicolons to separate statements
- Last expression is the output
- Define variables: a = $1 * 2; b = $2 + 3; a + b
- Define functions: add(a, b) = a + b; add($1, $2)

HANDLE IDS (Auto-generated):
- Message inlets: "message-in-0", "message-in-1", ... (multiple indexed)
- Message outlet: "message-out" (single)
- Each $N variable creates indexed inlet: "message-in-0" for $1, "message-in-1" for $2
- LIMITATION: Single outlet only, multiple inputs

Example - Simple Addition:
\`\`\`json
{
  "type": "expr",
  "data": {
    "expr": "$1 + $2"
  }
}
\`\`\`

Example - Scale and Offset:
\`\`\`json
{
  "type": "expr",
  "data": {
    "expr": "$1 * 100 + 50"
  }
}
\`\`\`

Example - Sine Wave Mapping:
\`\`\`json
{
  "type": "expr",
  "data": {
    "expr": "sin($1 * PI * 2) * 0.5 + 0.5"
  }
}
\`\`\`

Example - Multi-line with Variables:
\`\`\`json
{
  "type": "expr",
  "data": {
    "expr": "scaled = $1 * 10;\\noffset = $2;\\nscaled + offset"
  }
}
\`\`\``;

		case 'expr~':
			return `## expr~ Object Instructions

Audio-rate mathematical expression evaluator. Process audio signals with math expressions!

CRITICAL RULES:
1. Runs at AUDIO RATE (48kHz) - processes every audio sample
2. Use $1-$9 for control-rate inlets (receives messages)
3. Always needs audio input - use sig~ for constant signals
4. MUST connect to compressor~ or limiter~ - can create LOUD spikes!

Available variables:
- s: current sample value (-1 to 1)
- i: current sample index in buffer (0 to bufferSize)
- t: current time in seconds (float)
- channel: current channel index (0 or 1 for stereo)
- bufferSize: audio buffer size (usually 128)
- samples: array of all samples in current channel
- input: first input audio signal
- inputs: array of all connected input audio signals
- $1 to $9: control-rate inlet values

Available functions (same as expr):
- Arithmetic: +, -, *, /, ^, %
- Trigonometry: sin(), cos(), tan(), etc.
- Math: sqrt(), abs(), ceil(), floor(), round(), log(), exp()
- Logic: ==, !=, <, >, <=, >=, and, or, not
- Conditionals: condition ? true_val : false_val
- Constants: PI, E
- random(): white noise

Example - Pass Through:
\`\`\`json
{
  "type": "expr~",
  "data": {
    "expr": "s"
  }
}
\`\`\`

Example - Sine Wave Oscillator:
\`\`\`json
{
  "type": "expr~",
  "data": {
    "expr": "sin(t * $1 * PI * 2)"
  }
}
\`\`\`

Example - Gain Control:
\`\`\`json
{
  "type": "expr~",
  "data": {
    "expr": "s * $1"
  }
}
\`\`\`

Example - Distortion (squaring):
\`\`\`json
{
  "type": "expr~",
  "data": {
    "expr": "s ^ 2"
  }
}
\`\`\`

Example - White Noise:
\`\`\`json
{
  "type": "expr~",
  "data": {
    "expr": "random()"
  }
}
\`\`\`

Example - FM Synthesis (requires audio input):
\`\`\`json
{
  "type": "expr~",
  "data": {
    "expr": "sin(t * 440 * PI * 2 + s * $1)"
  }
}
\`\`\`

HANDLE IDS (Auto-generated):
- Audio inlet: "audio-in" (single)
- Audio outlet: "audio-out" (single)
- Message inlets: "message-in-0", "message-in-1", ... (for $1, $2, $3, etc.)
- LIMITATION: Single audio I/O, multiple message inlets

WARNING: Always use compressor~ after expr~ to prevent dangerous audio spikes!`;

		case 'button':
			return `## button Object Instructions

Simple button that sends a bang message when clicked.

CRITICAL RULES:
1. No code needed - configuration only
2. Outputs {type: 'bang'} when clicked
3. Flashes when receiving any message input

Messages:
- Receives: any message (triggers flash and outputs bang)
- Outputs: {type: 'bang'}

HANDLE IDS (Auto-generated):
- Message inlet: "message-in" (any message triggers flash and outputs bang)
- Message outlet: "message-out" (sends {type: "bang"} when clicked or triggered)

Example - Simple Button:
\`\`\`json
{
  "type": "button",
  "data": {}
}
\`\`\``;

		case 'toggle':
			return `## toggle Object Instructions

Boolean toggle switch for on/off control.

CRITICAL RULES:
1. No code needed - configuration only
2. Outputs true/false boolean values
3. Visual state changes on click

Messages:
- Receives: boolean (sets toggle state)
- Receives: bang (toggles state)
- Outputs: boolean (true/false)

HANDLE IDS (Auto-generated):
- Message inlet: "message-in" (boolean or bang to toggle)
- Message outlet: "message-out" (sends boolean true/false)

Example - Toggle Switch:
\`\`\`json
{
  "type": "toggle",
  "data": {
    "value": false
  }
}
\`\`\``;

		case 'msg':
			return `## msg Object Instructions

Message object that stores and sends predefined messages.

CRITICAL RULES:
1. Message format is VERY specific - follow these rules exactly
2. Bare strings (e.g. "start") become objects: {type: 'start'}
3. Quoted strings (e.g. "'hello'") become JS strings: "hello"
4. Numbers (e.g. 100) become numbers: 100
5. JSON objects are sent as-is, supports JSON5 syntax

Message Format Rules:
- bang → {type: 'bang'}
- start → {type: 'start'}
- play → {type: 'play'}
- 'hello world' → "hello world" (string)
- "hello world" → "hello world" (string)
- 100 → 100 (number)
- 0.5 → 0.5 (number)
- {x: 1, y: 2} → {x: 1, y: 2} (object)
- [1, 2, 3] → [1, 2, 3] (array)

HANDLE IDS (Auto-generated):
- Message inlet: "message-in" (bang or any message triggers output)
- Message outlet: "message-out" (sends the configured message)

Example - Bang Message:
\`\`\`json
{
  "type": "msg",
  "data": {
    "message": "bang"
  }
}
\`\`\`

Example - String Message:
\`\`\`json
{
  "type": "msg",
  "data": {
    "message": "'hello world'"
  }
}
\`\`\`

Example - Number Message:
\`\`\`json
{
  "type": "msg",
  "data": {
    "message": "440"
  }
}
\`\`\`

Example - Object Message:
\`\`\`json
{
  "type": "msg",
  "data": {
    "message": "{type: 'loop', value: false}"
  }
}
\`\`\``;

		case 'textbox':
			return `## textbox Object Instructions

Multi-line text input for user text entry.

CRITICAL RULES:
1. No code needed - configuration only
2. Outputs current text on bang
3. Accepts string input to set text

Messages:
- Receives: bang (outputs current text)
- Receives: string (sets text content)
- Outputs: string (current text)

HANDLE IDS (Auto-generated):
- Message inlet: "message-in" (receives text to set content)
- Message outlet: "message-out" (sends current text on bang)
- LIMITATION: Single I/O ports

Example - Text Input:
\`\`\`json
{
  "type": "textbox",
  "data": {
    "text": "Enter your text here..."
  }
}
\`\`\``;

		case 'canvas':
			return `## canvas Object Instructions

Offscreen HTML5 Canvas running on rendering pipeline (web worker). Use for high-performance video chaining.

CRITICAL RULES:
1. Runs on web worker thread (OffscreenCanvas) - NO DOM access
2. Fast video chaining - can chain with glsl/hydra without lag
3. Use canvas.dom instead if you need mouse/keyboard/DOM
4. FFT has high delay due to worker message passing

Available in context:
- ctx: 2D rendering context
- width, height: canvas dimensions
- noDrag(): disable node dragging
- noOutput(): hide video output port
- setTitle(title): set node title
- setCanvasSize(w, h): resize canvas
- send(message), recv(callback): message passing
- fft(): audio analysis (high delay on worker)

HANDLE IDS (Auto-generated):
- Video outlet: "video-out" (for rendering the canvas)
- Message inlet: "message-in" (for receiving control messages)

Example - Animated Circle:
\`\`\`json
{
  "type": "canvas",
  "data": {
    "code": "let angle = 0;\\n\\nfunction draw() {\\n  ctx.fillStyle = '#18181b';\\n  ctx.fillRect(0, 0, width, height);\\n\\n  const x = width / 2 + Math.cos(angle) * 100;\\n  const y = height / 2 + Math.sin(angle) * 100;\\n\\n  ctx.fillStyle = '#4ade80';\\n  ctx.beginPath();\\n  ctx.arc(x, y, 20, 0, Math.PI * 2);\\n  ctx.fill();\\n\\n  angle += 0.05;\\n  requestAnimationFrame(draw);\\n}\\n\\ndraw();"
  }
}
\`\`\``;

		case 'strudel':
			return `## strudel Object Instructions

Strudel live coding environment based on TidalCycles for expressive music patterns.

CRITICAL RULES:
1. Use Strudel pattern syntax (mini-notation)
2. MUST connect to dac~ to hear audio
3. Use Ctrl/Cmd + Enter in editor to re-evaluate
4. Only ONE strudel can play at a time

Available functions:
- recv(callback): limited support, works with setcpm
- Standard Strudel pattern functions


HANDLE IDS (Auto-generated):
- Message inlet: "message-in" (single)
- Audio outlet: "audio-out" (single)
- Message outlet: "message-out" (single)
- LIMITATION: Single audio outlet, cannot split to multiple nodes

Messages:
- bang or run: evaluates code and starts playback
- string or {type: 'set', code: '...'}: sets code

Example - Simple Drum Pattern:
\`\`\`json
{
  "type": "strudel",
  "data": {
    "code": "sound(\\"bd sd, hh*4\\").cpm(120)"
  }
}
\`\`\`

Example - Melodic Pattern:
\`\`\`json
{
  "type": "strudel",
  "data": {
    "code": "note(\\"<c3 eb3 g3 bb3>\\").s('sawtooth').lpf(800).cpm(90)"
  }
}
\`\`\`

Example - Complex Pattern:
\`\`\`json
{
  "type": "strudel",
  "data": {
    "code": "stack(\\n  sound(\\"bd sd\\").bank('RolandTR808'),\\n  note(\\"c2 [eb2 g2] <f2 bb2>\\").s('sawtooth')\\n).cpm(120)"
  }
}
\`\`\``;

		case 'python':
			return `## python Object Instructions

Python code execution using Pyodide in the browser.

CRITICAL RULES:
1. Full Python 3 standard library available
2. Great for data processing and numerical computation
3. Use print() for output
4. Runs in browser via Pyodide

Available:
- Full Python standard library
- send(data): send messages to outlets
- recv(callback): receive messages from inlets
- setPortCount(inlets, outlets): set message ports

HANDLE IDS (Auto-generated):
- Message inlet: "message-in" (single)
- Message outlet: "message-out" (single)
- LIMITATION: Single inlet/outlet only

Example - Simple Calculation:
\`\`\`json
{
  "type": "python",
  "data": {
    "code": "import math\\n\\nresult = math.sqrt(16)\\nprint(f\\"Result: {result}\\")"
  }
}
\`\`\`

Example - Data Processing:
\`\`\`json
{
  "type": "python",
  "data": {
    "code": "def fibonacci(n):\\n    a, b = 0, 1\\n    result = []\\n    for _ in range(n):\\n        result.append(a)\\n        a, b = b, a + b\\n    return result\\n\\nfib = fibonacci(10)\\nprint(fib)"
  }
}
\`\`\``;

		case 'swgl':
			return `## swgl Object Instructions

SwissGL shader - WebGL2 wrapper for creating shaders in very few lines of code.

CRITICAL RULES:
1. Must implement render() function
2. Uses SwissGL API (different from GLSL)
3. Supports Mesh, VP (vertex position), FP (fragment)
4. Much more concise than raw GLSL

Available:
- glsl(): main SwissGL function
- render({ t }): render function with time parameter
- Mesh: [width, height] for mesh generation
- VP: vertex position string
- FP: fragment color string

Example - Animated Mesh:
\`\`\`json
{
  "type": "swgl",
  "data": {
    "code": "function render({ t }) {\\n  glsl({\\n    t,\\n    Mesh: [10, 10],\\n    VP: \`XY*0.8+sin(t+XY.yx*2.0)*0.2,0,1\`,\\n    FP: \`UV,0.5,1\`,\\n  });\\n}"
  }
}
\`\`\`

HANDLE IDS (Auto-generated):
- Message inlet: "message-in-0" (single, indexed)
- Video outlet: "video-out-0" (single, indexed)
- LIMITATION: Single I/O ports

Example - Color Wave:
\`\`\`json
{
  "type": "swgl",
  "data": {
    "code": "function render({ t }) {\\n  glsl({\\n    t,\\n    FP: \`vec3(sin(t+XY.x*5.0), cos(t+XY.y*3.0), 0.5),1\`,\\n  });\\n}"
  }
}
\`\`\``;

		case 'uxn':
			return `## uxn Object Instructions

Uxn virtual machine for running programs written in Uxntal assembly.

CRITICAL RULES:
1. Conforms to Varvara device specifications
2. Write Uxntal assembly code
3. Press Shift+Enter to assemble and load
4. Canvas captures keyboard/mouse input (click to focus)

Available:
- Full Uxntal instruction set
- Console output sent as messages
- Video output supports chaining
- Load ROM: drop .rom file or use Load ROM button

Messages:
- string (URL): load ROM from URL
- Uint8Array: load ROM from binary
- File: load ROM from file
- {type: 'load', url: string}: load ROM from URL
- Outputs: console strings

HANDLE IDS (Auto-generated):
- Message inlet: "message-in-0" (receives ROM data)
- Video outlet: "video-out-0" (indexed, canvas output)
- Message outlet: "message-out-0" (console output)
- LIMITATION: Specialized I/O for ROM loading

Example - Hello World:
\`\`\`json
{
  "type": "uxn",
  "data": {
    "code": "|10 @Console &vector $2 &read $1 &pad $5 &write $1\\n\\n|100\\n  ;hello-txt\\n  &loop\\n    LDAk .Console/write DEO\\n    INC2 LDAk ,&loop JCN\\n  POP2\\n  BRK\\n\\n@hello-txt \\"Hello 20 \\"World! 00"
  }
}
\`\`\``;

		case 'asm':
			return `## asm Object Instructions

Virtual stack machine assembly interpreter inspired by TIS-100 and Shenzhen I/O.

CRITICAL RULES:
1. Stack-based assembly language
2. Over 50 assembly instructions
3. Line-by-line instruction highlighting
4. External memory cells via asm.mem

Available instructions:
- Stack: PUSH, POP, DUP, SWAP, OVER, ROT
- Arithmetic: ADD, SUB, MUL, DIV, MOD, NEG
- Comparison: EQ, NEQ, LT, GT, LTE, GTE
- Logic: AND, OR, NOT, XOR
- Control: JMP, JZ, JNZ, CALL, RET, HALT
- I/O: IN, OUT, PEEK, POKE
- Memory: LOAD, STORE

HANDLE IDS (Auto-generated):
- LIMITATION: No handles for assembly programs
- Assembly nodes don't have traditional I/O ports
- Configure internally via stack/memory operations

Example - Simple Counter:
\`\`\`json
{
  "type": "asm",
  "data": {
    "code": "PUSH 0\\nLOOP:\\nDUP\\nOUT 0\\nPUSH 1\\nADD\\nJMP LOOP"
  }
}
\`\`\`

Example - Fibonacci:
\`\`\`json
{
  "type": "asm",
  "data": {
    "code": "PUSH 0\\nPUSH 1\\nLOOP:\\nDUP\\nOUT 0\\nSWAP\\nOVER\\nADD\\nJMP LOOP"
  }
}
\`\`\``;

		case 'orca':
			return `## orca Object Instructions

Orca esoteric programming language - every character is an operation running sequentially each frame.

CRITICAL RULES:
1. Grid-based visual programming
2. 26 letter operators (A-Z) for operations
3. Output-agnostic MIDI (noteOn, noteOff, controlChange)
4. Connect to midi.out or tone~ synth presets

Key operators:
- A-Z: Math, logic, movement operations
- :: MIDI note (channel, octave, note, velocity, length)
- %: Monophonic MIDI
- !: MIDI Control Change
- U: Euclidean rhythm generator (great for drums!)
- V: Variables
- R: Random values
- *: Bang operator
- #: Comment (halts line)

Controls:
- Click canvas to edit
- Space: play/pause
- Enter: advance one frame
- Arrow keys: navigate
- Type to edit grid

Example - Simple Melody:
\`\`\`json
{
  "type": "orca",
  "data": {
    "grid": "D8.......\\n:03C....."
  }
}
\`\`\`

Example - Euclidean Drums:
\`\`\`json
{
  "type": "orca",
  "data": {
    "grid": "U8.4....\\n*:01C.4."
  }
}
\`\`\``;

		case 'chuck~':
			return `## chuck~ Object Instructions

ChucK audio programming language for real-time sound synthesis.

CRITICAL RULES:
1. Write ChucK code for algorithmic composition
2. Use Ctrl/Cmd + Enter to replace most recent shred
3. Use Ctrl/Cmd + \\ to add new shred
4. Use Ctrl/Cmd + Backspace to remove shred
5. MUST connect to dac~ for audio output

Available:
- Full ChucK language
- Runs via WebChucK in browser
- Multiple concurrent shreds
- Real-time synthesis

HANDLE IDS (Auto-generated):
- Message inlet: "message-in" (single)
- Audio outlet: "audio-out" (single)
- LIMITATION: Single audio outlet only

Example - Sine Wave:
\`\`\`json
{
  "type": "chuck~",
  "data": {
    "code": "SinOsc s => dac;\\n440 => s.freq;\\n0.5 => s.gain;\\nwhile(true) { 1::second => now; }"
  }
}
\`\`\`

Example - FM Synth:
\`\`\`json
{
  "type": "chuck~",
  "data": {
    "code": "SinOsc mod => SinOsc car => dac;\\n2 => mod.sync;\\n200 => mod.freq;\\n440 => car.freq;\\nwhile(true) {\\n  Math.random2f(100,500) => mod.freq;\\n  200::ms => now;\\n}"
  }
}
\`\`\``;

		case 'csound~':
			return `## csound~ Object Instructions

Csound sound and music computing system.

CRITICAL RULES:
1. Write Csound orchestra and score code
2. WARNING: Only ONE csound~ per patch (known bug)
3. MUST connect to dac~ for audio output
4. Use instr/endin blocks for instruments

Messages:
- bang: resume or re-eval code
- play/pause/stop/reset: playback control
- {type: 'setChannel', channel: 'name', value: number}: set control channel
- {type: 'noteOn', note: 60, velocity: 127}: MIDI note on
- {type: 'noteOff', note: 60}: MIDI note off
- {type: 'readScore', value: 'i1 0 1'}: send score
- {type: 'eval', code: '...'}: evaluate code

HANDLE IDS (Auto-generated):
- Audio inlet: "audio-in-0" (indexed)
- Message inlet: "message-in-1" (indexed)
- Audio outlet: "audio-out-0" (single)
- LIMITATION: Multiple inlets but single audio outlet

Example - Simple Sine:
\`\`\`json
{
  "type": "csound~",
  "data": {
    "code": "instr 1\\n  asig oscili 0.5, 440\\n  out asig\\nendin\\nschedule(1, 0, 10)"
  }
}
\`\`\`

Example - FM Synth:
\`\`\`json
{
  "type": "csound~",
  "data": {
    "code": "instr 1\\n  ifreq = p4\\n  amod oscili 200, ifreq*2\\n  acar oscili 0.5, ifreq + amod\\n  out acar\\nendin\\nschedule(1, 0, 2, 440)"
  }
}
\`\`\``;

		case 'soundfile~':
			return `## soundfile~ Object Instructions

Load and play audio files with transport controls.

CRITICAL RULES:
1. No code needed - file loading object
2. Connect to dac~ to hear audio
3. Supports audio chaining as source


HANDLE IDS (Auto-generated):
- Message inlet: "message-in" (single)
- Audio outlet: "audio-out" (single)
- LIMITATION: Single audio outlet only - cannot split to multiple receivers

Messages:
- string or {type: 'load', url: '...'}: load audio file
- bang: restart playback
- play: start playback
- pause: pause playback
- stop: stop playback
- {type: 'loop', value: boolean}: set looping
- read: read file (used with convolver~)

Example - Audio Player:
\`\`\`json
{
  "type": "soundfile~",
  "data": {
    "url": "https://example.com/audio.mp3",
    "loop": true
  }
}
\`\`\``;

		case 'sampler~':
			return `## sampler~ Object Instructions

Sample playback with triggering capabilities.

CRITICAL RULES:
1. Load audio samples for triggered playback
2. Great for drum machines and one-shots
3. Connect to dac~ for audio output

Messages:
- string: load sample from URL
- bang: trigger sample playback
- number: set playback rate/pitch
- {type: 'load', url: '...'}: load sample

Example - Drum Sample:
\`\`\`json
{
  "type": "sampler~",
  "data": {
    "url": "https://example.com/kick.wav"
  }
}
\`\`\``;

		case 'markdown':
			return `## markdown Object Instructions

Markdown text renderer for documentation and formatted content.

CRITICAL RULES:
1. No code needed - markdown content only
2. Supports full Markdown syntax
3. Great for patch documentation

Messages:
- string: set markdown content

HANDLE IDS (Auto-generated):
- Message inlet: "message-in" (receives markdown string)
- LIMITATION: Display only, no outlets

HANDLE IDS (Auto-generated):
- LIMITATION: Display only, no inlets or outlets
- Configure via node data only

Example - Documentation:
\`\`\`json
{
  "type": "markdown",
  "data": {
    "content": "# My Patch\\n\\nThis patch does **amazing** things:\\n\\n- Feature 1\\n- Feature 2\\n- Feature 3"
  }
}
\`\`\`

Example - Instructions:
\`\`\`json
{
  "type": "markdown",
  "data": {
    "content": "## How to use\\n\\n1. Connect the slider to the frequency inlet\\n2. Press the button to start\\n3. Adjust parameters to taste"
  }
}
\`\`\``;

		default:
			// Generic fallback for objects not explicitly handled
			return `## ${objectType} Object

Generate appropriate configuration for this object type based on the user's prompt.

Respond with valid JSON:
{
  "type": "${objectType}",
  "data": {
    // appropriate fields for this object type
  }
}`;
	}
}

/**
 * Object type descriptions for routing (lightweight, no implementation details)
 */
export const OBJECT_TYPE_LIST = `## Visual & Creative Coding Objects
- p5: P5.js sketches for interactive graphics and animations
- hydra: Live coding video synthesis with Hydra
- glsl: GLSL fragment shaders for visual effects
- canvas: HTML5 Canvas 2D (offscreen, for video chaining)
- canvas.dom: Interactive HTML5 Canvas with mouse/keyboard input
- swgl: SwissGL shaders for WebGL2
- img: Display images from URLs or local files
- video: Display and play videos
- bchrn: Winamp Milkdrop visualizer (Butterchurn)
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
- object: Textual audio objects (osc~, gain~, filter~, etc.)

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

## AI & Generation Objects
- ai.txt: AI text generation
- ai.img: AI image generation
- ai.music: AI music generation
- ai.tts: AI text-to-speech

## Documentation & Content
- markdown: Markdown renderer
- iframe: Embed web content

## Media Input
- webcam: Webcam video input
- screen: Screen capture
- mic~: Microphone audio input`;
