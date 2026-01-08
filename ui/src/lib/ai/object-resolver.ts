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

AVAILABLE OBJECT TYPES:

Audio Objects (use "tone~" type with custom code):
- tone~: Tone.js audio synthesis and processing
  Example data: { code: "const synth = new Tone.Synth().toDestination();", messageInletCount: 1 }
- dsp~: Custom DSP audio processing
- elem~: Elementary Audio synthesis
- sonic~: SuperSonic audio synthesis
- chuck~: ChucK audio programming

Video/Visual Objects:
- hydra: Live coding video synthesis
- glsl: GLSL fragment shaders
- p5: P5.js creative coding
- canvas: HTML5 Canvas 2D
- swgl: SwissGL shaders

Control/UI Objects:
- slider: Number slider (data: { min, max, defaultValue })
- button: Clickable button
- toggle: Boolean toggle switch
- msg: Message sender (data: { message: "text" })

Code Objects:
- js: JavaScript code execution
- python: Python code with Pyodide
- expr: Math expression evaluator

AI Objects:
- ai.txt: AI text generation
- ai.img: AI image generation

Common Presets Available:
${presetNames.slice(0, 20).join(', ')}... and more

EXAMPLES:

User: "give me a simple fat sine oscillator"
Response:
{
  "type": "tone~",
  "data": {
    "code": "setTitle('sine~')\\n\\nconst synth = new Tone.Synth({\\n  oscillator: {\\n    type: 'fatsine'\\n  }\\n}).toDestination();\\n\\nrecv(m => {\\n  if (m.type === 'noteOn') {\\n    const freq = Tone.Frequency(m.note, 'midi').toFrequency();\\n    synth.triggerAttackRelease(freq, '8n');\\n  }\\n});",
    "messageInletCount": 1,
    "title": "sine~"
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
    "code": "setTitle('lowpass~')\\nsetPortCount(1)\\n\\nconst filter = new Tone.Filter(500, 'lowpass');\\ninputNode.connect(filter);\\nfilter.toDestination();\\n\\nrecv(m => {\\n  filter.frequency.value = m;\\n});",
    "messageInletCount": 1,
    "title": "lowpass~"
  }
}

Now convert the user's prompt into a single object configuration. Respond with ONLY the JSON object.`;
}
