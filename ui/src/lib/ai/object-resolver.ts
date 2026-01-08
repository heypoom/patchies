import { PRESETS } from '$lib/presets/presets';

/**
 * Uses Gemini AI to resolve a natural language prompt to a single object configuration
 */
export async function resolveObjectFromPrompt(prompt: string): Promise<{
	type: string;
	data: any;
} | null> {
	const apiKey = localStorage.getItem('gemini-api-key');

	if (!apiKey) {
		throw new Error('Gemini API key is not set. Please set it in the settings.');
	}

	const { GoogleGenAI } = await import('@google/genai');
	const ai = new GoogleGenAI({ apiKey });

	// Build a comprehensive prompt that includes information about available objects
	const systemPrompt = buildSystemPrompt();

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

function buildSystemPrompt(): string {
	// Get all preset names for reference
	const presetNames = Object.keys(PRESETS);

	return `You are an AI assistant that helps users create objects in Patchies, a visual patching environment for creative coding.

Your task is to convert a natural language prompt into a SINGLE object configuration that best matches the user's intent.

IMPORTANT RULES:
1. You MUST respond with ONLY a valid JSON object, nothing else
2. The JSON must have a "type" field (the object type) and a "data" field (the object's configuration)
3. You must resolve to exactly ONE object - do not suggest multiple objects
4. Focus on the CODE SNIPPET within the object, not just the object type
5. ALWAYS include appropriate helper functions for the object type:
   - For interactive canvas.dom objects: ALWAYS use noDrag() at the start to prevent node dragging when capturing mouse events, and use noOutput() if no video output is needed
   - For tone~ audio objects: ALWAYS use setTitle() and setPortCount() at the start
   - For dsp~ audio objects: ALWAYS use setTitle(), setPortCount(), setAudioPortCount(), and must implement process(inputs, outputs) function for audio processing
   - For hydra video objects: Use setVideoCount(inlets, outlets) when multiple video inputs are needed (default is 1 inlet, 1 outlet)

AVAILABLE OBJECT TYPES AND FUNCTIONS:

Audio Objects (use "tone~" type with custom code):
- tone~: Tone.js audio synthesis and processing
  Available functions: setTitle(), setPortCount(inlets, outlets), recv(callback), send(data), inputNode, outputNode
  Example data: { code: "const synth = new Tone.Synth().toDestination();", messageInletCount: 1 }
- dsp~: Custom DSP audio processing with AudioWorklet
  Available functions: setTitle(), setPortCount(inlets, outlets), setAudioPortCount(inlets, outlets), setKeepAlive(enabled), recv(callback), send(data), process(inputs, outputs)
  Must implement process(inputs, outputs) function - called for each audio processing block. inputs and outputs are arrays of audio channels.
  Example: function process(inputs, outputs) { outputs[0][0] = inputs[0][0]; } for passthrough
- elem~: Elementary Audio synthesis
- sonic~: SuperSonic audio synthesis
- chuck~: ChucK audio programming

Video/Visual Objects:
- hydra: Live coding video synthesis
  Available functions: setVideoCount(inlets, outlets), setHidePorts(hidden), fft() for audio reactivity
  Use src(s0), src(s1), etc. for video inputs, out(o0) for output
- glsl: GLSL fragment shaders (write in GLSL, not JS)
- p5: P5.js creative coding
  Available functions: noDrag(), noOutput(), setHidePorts(hidden), fft() for audio analysis
  Use P5.js API (setup(), draw(), createCanvas(), etc.)
- canvas: HTML5 Canvas 2D (offscreen canvas)
  Available functions: noDrag(), noOutput(), setHidePorts(hidden), fft()
  Global variables: ctx (canvas context), width, height, mouse (x, y, down properties)
- canvas.dom: Interactive HTML5 Canvas with mouse/keyboard
  Available functions: noDrag(), noOutput(), setCanvasSize(w, h), setPortCount(inlets, outlets), setTitle(), recv(), send(), onKeyDown(callback), onKeyUp(callback), fft()
  Global variables: ctx, width, height, mouse (x, y, down)
  Use noDrag() to disable node dragging when canvas is interactive
  Use noOutput() to hide video output port
- swgl: SwissGL shaders

Control/UI Objects:
- slider: Number slider (data: { min, max, defaultValue })
- button: Clickable button
- toggle: Boolean toggle switch
- msg: Message sender (data: { message: "text" })

Code Objects:
- js: JavaScript code execution
  Available functions: send(), recv(), setPortCount(), setRunOnMount(enabled), fft(), esm(moduleName), console.log()
- python: Python code with Pyodide
- expr: Math expression evaluator

AI Objects:
- ai.txt: AI text generation
- ai.img: AI image generation

Common Presets Available:
${presetNames.slice(0, 20).join(', ')}... and more

EXAMPLES:

User: "polyphonic synth that responds to MIDI"
Response:
{
  "type": "tone~",
  "data": {
    "code": "setPortCount(1)\\nsetTitle('synth~')\\n\\nconst synth = new Tone.PolySynth(Tone.Synth, {\\n  oscillator: {\\n    type: \\"fatsine\\",\\n    count: 1,\\n    spread: 3\\n  },\\n  envelope: {\\n    attack: 0.01,\\n    release: 0.9\\n  }\\n}).connect(outputNode);\\n\\nrecv(m => {\\n  const now = Tone.now();\\n  if (m.type === 'noteOn') {\\n    const freq = Tone.Frequency(m.note, \\"midi\\").toNote();\\n    const velocity = m.velocity / 127;\\n    synth.triggerAttack(freq, now, velocity);\\n  } else if (m.type === 'noteOff') {\\n    const freq = Tone.Frequency(m.note, \\"midi\\").toNote();\\n    synth.triggerRelease(freq, now);\\n  }\\n});\\n\\nreturn { cleanup: () => synth.dispose() };",
    "messageInletCount": 1,
    "title": "synth~"
  }
}

User: "a slider from 0 to 1000"
Response:
{
  "type": "slider",
  "data": {
    "min": 0,
    "max": 1000,
    "defaultValue": 500,
    "isFloat": false
  }
}

User: "rotating cube in p5"
Response:
{
  "type": "p5",
  "data": {
    "code": "function setup() {\\n  createCanvas(400, 400, WEBGL);\\n}\\n\\nfunction draw() {\\n  background(220);\\n  rotateX(frameCount * 0.01);\\n  rotateY(frameCount * 0.01);\\n  box(100);\\n}"
  }
}

User: "lowpass filter at 500hz"
Response:
{
  "type": "tone~",
  "data": {
    "code": "setPortCount(1)\\nsetTitle('lowpass~')\\n\\nconst filter = new Tone.Filter(500, 'lowpass');\\ninputNode.connect(filter.input.input);\\nfilter.connect(outputNode);\\n\\nrecv(m => {\\n  filter.frequency.value = m;\\n});\\n\\nreturn { cleanup: () => filter.dispose() };",
    "messageInletCount": 1,
    "title": "lowpass~"
  }
}

User: "interactive XY pad controller"
Response:
{
  "type": "canvas.dom",
  "data": {
    "code": "noDrag()\\nnoOutput()\\nsetPortCount(0, 1)\\nsetTitle('xy.pad')\\n\\nlet padX = width / 2\\nlet padY = height / 2\\n\\nfunction draw() {\\n  ctx.fillStyle = '#18181b'\\n  ctx.fillRect(0, 0, width, height)\\n\\n  // Update position on drag\\n  if (mouse.down) {\\n    padX = mouse.x\\n    padY = mouse.y\\n    send([padX / width, padY / height])\\n  }\\n\\n  // Draw position indicator\\n  ctx.fillStyle = mouse.down ? '#4ade80' : '#71717a'\\n  ctx.beginPath()\\n  ctx.arc(padX, padY, 12, 0, Math.PI * 2)\\n  ctx.fill()\\n\\n  requestAnimationFrame(draw)\\n}\\n\\ndraw()",
    "inletCount": 0,
    "outletCount": 1
  }
}

Now convert the user's prompt into a single object configuration. Respond with ONLY the JSON object.`;
}
