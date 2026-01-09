/**
 * Single object resolution using two-stage AI approach.
 * 1. Router call: Determines which object type to use (lightweight)
 * 2. Generator call: Generates the full object configuration (targeted)
 */

import { getObjectSpecificInstructions, OBJECT_TYPE_LIST } from './object-descriptions';

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

${OBJECT_TYPE_LIST}

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
