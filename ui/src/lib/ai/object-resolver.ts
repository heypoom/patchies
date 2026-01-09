/**
 * Uses Gemini AI to resolve a natural language prompt to a single object configuration.
 * Uses a two-call approach:
 * 1. Router call: Determines which object type to use (lightweight)
 * 2. Generator call: Generates the full object configuration (targeted)
 */
export async function resolveObjectFromPrompt(prompt: string): Promise<{
	type: string;

	// eslint-disable-next-line @typescript-eslint/no-explicit-any -- fixme
	data: any;
} | null> {
	const apiKey = localStorage.getItem('gemini-api-key');

	if (!apiKey) {
		throw new Error('Gemini API key is not set. Please set it in the settings.');
	}

	const { GoogleGenAI } = await import('@google/genai');
	const ai = new GoogleGenAI({ apiKey });

	// Call 1: Route to object type (lightweight)
	const objectType = await routeToObjectType(ai, prompt);
	if (!objectType) {
		return null;
	}

	// Call 2: Generate object config (targeted)
	const config = await generateObjectConfig(ai, prompt, objectType);
	return config;
}

/**
 * Edit an existing object with a known type - skips routing, goes directly to generation.
 * This is more efficient for edit operations since we already know the object type.
 */
export async function editObjectFromPrompt(
	prompt: string,
	objectType: string,
	existingCode?: string
): Promise<{
	type: string;

	// eslint-disable-next-line @typescript-eslint/no-explicit-any -- fixme
	data: any;
} | null> {
	const apiKey = localStorage.getItem('gemini-api-key');

	if (!apiKey) {
		throw new Error('Gemini API key is not set. Please set it in the settings.');
	}

	const { GoogleGenAI } = await import('@google/genai');
	const ai = new GoogleGenAI({ apiKey });

	// Enhance prompt with existing code context if provided
	let enhancedPrompt = prompt;
	if (existingCode) {
		enhancedPrompt = `Modify this existing ${objectType} object. Current code:\n${existingCode}\n\nUser request: ${prompt}`;
	} else {
		enhancedPrompt = `Modify this existing ${objectType} object. User request: ${prompt}`;
	}

	// Single call: Generate object config (we already know the type)
	const config = await generateObjectConfig(ai, enhancedPrompt, objectType);
	return config;
}

/**
 * Call 1: Routes the user prompt to the most appropriate object type.
 * This is a lightweight call that only includes object descriptions, not implementation details.
 */
async function routeToObjectType(
	ai: InstanceType<typeof import('@google/genai').GoogleGenAI>,
	prompt: string
): Promise<string | null> {
	const routerPrompt = buildRouterPrompt();

	const response = await ai.models.generateContent({
		model: 'gemini-2.5-flash',
		contents: [{ text: `${routerPrompt}\n\nUser prompt: "${prompt}"` }]
	});

	const responseText = response.text?.trim();
	if (!responseText) {
		return null;
	}

	// Response should be just the object type name
	return responseText;
}

/**
 * Call 2: Generates the full object configuration for the chosen object type.
 * This is a targeted call that includes only the relevant system prompt and API docs.
 */
async function generateObjectConfig(
	ai: InstanceType<typeof import('@google/genai').GoogleGenAI>,
	prompt: string,
	objectType: string
): Promise<{
	type: string;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any -- fixme
	data: any;
} | null> {
	const systemPrompt = buildGeneratorPrompt(objectType);

	const response = await ai.models.generateContent({
		model: 'gemini-2.5-flash',
		contents: [{ text: `${systemPrompt}\n\nUser prompt: "${prompt}"` }]
	});

	const responseText = response.text?.trim();
	if (!responseText) {
		return null;
	}

	try {
		// Extract JSON from response (handle markdown code blocks)
		const jsonMatch = responseText.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
		const jsonText = jsonMatch ? jsonMatch[1] : responseText;

		const result = JSON.parse(jsonText);

		// Validate the result has required fields
		if (!result.type) {
			throw new Error('Response missing required "type" field');
		}

		return {
			type: result.type,
			data: result.data || {}
		};
	} catch (error) {
		console.error('Failed to parse AI response:', error);
		console.log('Response text:', responseText);
		throw new Error('Failed to parse AI response as JSON');
	}
}

/**
 * Builds the router prompt - lightweight, only object descriptions
 */
function buildRouterPrompt(): string {
	return `You are an AI assistant that routes user prompts to the most appropriate object type in Patchies, a visual patching environment for creative coding.

Your task: Read the user's prompt and return ONLY the object type name that best matches their intent. Return just the type name, nothing else.

AVAILABLE OBJECT TYPES:

## Visual & Creative Coding Objects
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
- mic~: Microphone audio input

EXAMPLES:
- "polyphonic synth" → tone~
- "rotating cube" → p5
- "slider from 0 to 1000" → slider
- "lowpass filter" → tone~
- "XY pad controller" → canvas.dom
- "fragment shader" → glsl
- "play audio file" → soundfile~
- "python script" → python
- "visualize audio spectrum" → p5
- "MIDI keyboard input" → midi.in

Now, return ONLY the object type for this prompt:`;
}

/**
 * Builds the generator prompt - targeted for specific object type
 */
function buildGeneratorPrompt(objectType: string): string {
	const basePrompt = `You are an AI assistant that generates object configurations in Patchies, a visual patching environment for creative coding.

Your task is to create a complete configuration for a "${objectType}" object based on the user's prompt.

IMPORTANT RULES:
1. You MUST respond with ONLY a valid JSON object, nothing else
2. The JSON must have a "type" field (set to "${objectType}") and a "data" field (the object's configuration)
3. Focus on generating the CODE SNIPPET and configuration, not just generic settings
4. Include all necessary helper functions and setup code

RESPONSE FORMAT:
{
  "type": "${objectType}",
  "data": {
    "code": "...", // or other relevant fields
    // other configuration fields
  }
}

`;

	// Add object-specific instructions
	const objectInstructions = getObjectSpecificInstructions(objectType);

	return basePrompt + objectInstructions;
}

/**
 * Returns detailed instructions and examples for a specific object type
 */
function getObjectSpecificInstructions(objectType: string): string {
	switch (objectType) {
		case 'tone~':
			return `## tone~ Object Instructions

CRITICAL RULES FOR TONE.JS:
1. NEVER use .toDestination() - always use .connect(outputNode)
2. ALWAYS call setTitle() and setPortCount() at the start
3. To connect audio inlet: inputNode.connect(node.input.input) (mind the double .input)
4. ALWAYS return cleanup object: { cleanup: () => node.dispose() }

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

Example - Random Number Generator:
\`\`\`json
{
  "type": "js",
  "data": {
    "code": "setRunOnMount(true)\\nsetPortCount(0, 1)\\n\\nsetInterval(() => {\\n  send(Math.random());\\n}, 1000);"
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
