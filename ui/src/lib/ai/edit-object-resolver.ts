/**
 * Edit object resolver - skips routing since we already know the object type.
 * This is more efficient for edit operations.
 */

import { getObjectSpecificInstructions } from './object-descriptions';

/**
 * Edit an existing object with a known type - skips routing, goes directly to generation.
 * This is more efficient for edit operations since we already know the object type.
 */
export async function editObjectFromPrompt(
	prompt: string,
	objectType: string,
	existingData?: Record<string, unknown>
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

	// Enhance prompt with existing data context if provided
	let enhancedPrompt = prompt;
	if (existingData && Object.keys(existingData).length > 0) {
		// Stringify the data - non-serializable objects will become [object Object] which is fine
		const dataString = JSON.stringify(existingData, null, 2);
		enhancedPrompt = `Modify this existing ${objectType} object. Current data:\n${dataString}\n\nUser request: ${prompt}`;
	} else {
		enhancedPrompt = `Modify this existing ${objectType} object. User request: ${prompt}`;
	}

	// Single call: Generate object config (we already know the type)
	const config = await generateObjectConfig(ai, enhancedPrompt, objectType);
	return config;
}

/**
 * Generates the full object configuration for editing.
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
