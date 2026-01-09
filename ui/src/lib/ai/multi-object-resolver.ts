/**
 * Multi-object resolution using two-stage AI approach.
 * 1. Router call: Determines which object types to use and how they connect (lightweight)
 * 2. Generator call: Generates the full object configurations (targeted)
 */

import { getObjectSpecificInstructions, OBJECT_TYPE_LIST } from './object-descriptions';

export type SimplifiedEdge = {
	source: number; // Index of source node in nodes array
	target: number; // Index of target node in nodes array
	sourceHandle?: string; // e.g., 'message-0', 'audio-0'
	targetHandle?: string; // e.g., 'message-0', 'audio-0'
};

export type MultiObjectResult = {
	nodes: Array<{
		type: string;
		// eslint-disable-next-line @typescript-eslint/no-explicit-any -- fixme
		data: any;
		position?: { x: number; y: number }; // Optional relative positioning
	}>;
	edges: SimplifiedEdge[];
};

/**
 * Uses Gemini AI to resolve a natural language prompt to multiple connected objects.
 * Uses a two-call approach:
 * 1. Router call: Determines which object types to use and how they connect (lightweight)
 * 2. Generator call: Generates the full object configurations (targeted)
 */
export async function resolveMultipleObjectsFromPrompt(
	prompt: string
): Promise<MultiObjectResult | null> {
	const apiKey = localStorage.getItem('gemini-api-key');

	if (!apiKey) {
		throw new Error('Gemini API key is not set. Please set it in the settings.');
	}

	const { GoogleGenAI } = await import('@google/genai');
	const ai = new GoogleGenAI({ apiKey });

	// Call 1: Route to object types and structure (lightweight)
	const plan = await routeToMultiObjectPlan(ai, prompt);
	if (!plan) {
		return null;
	}

	// Call 2: Generate full object configs (targeted)
	const result = await generateMultiObjectConfig(ai, prompt, plan);
	return result;
}

/**
 * Call 1 (Multi-object): Routes to object types and determines connection structure.
 * This is a lightweight call that only includes object descriptions.
 */
async function routeToMultiObjectPlan(
	ai: InstanceType<typeof import('@google/genai').GoogleGenAI>,
	prompt: string
): Promise<{ objectTypes: string[]; structure: string } | null> {
	const routerPrompt = buildMultiObjectRouterPrompt();

	const response = await ai.models.generateContent({
		model: 'gemini-2.5-flash',
		contents: [{ text: `${routerPrompt}\n\nUser prompt: "${prompt}"` }]
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

		if (!result.objectTypes || !Array.isArray(result.objectTypes)) {
			throw new Error('Response missing required "objectTypes" array');
		}

		if (!result.structure) {
			throw new Error('Response missing required "structure" field');
		}

		console.log('[AI Multi-Object Router] Object types:', result.objectTypes);
		console.log('[AI Multi-Object Router] Structure:', result.structure);

		return result;
	} catch (error) {
		console.error('Failed to parse routing response:', error);
		console.log('Response text:', responseText);
		throw new Error('Failed to parse routing response as JSON');
	}
}

/**
 * Call 2 (Multi-object): Generates full object configurations based on the plan.
 * This is a targeted call that includes only relevant system prompts.
 */
async function generateMultiObjectConfig(
	ai: InstanceType<typeof import('@google/genai').GoogleGenAI>,
	prompt: string,
	plan: { objectTypes: string[]; structure: string }
): Promise<MultiObjectResult | null> {
	const systemPrompt = buildMultiObjectGeneratorPrompt(plan.objectTypes, plan.structure);

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
		if (!result.nodes || !Array.isArray(result.nodes)) {
			throw new Error('Response missing required "nodes" array');
		}

		if (!result.edges || !Array.isArray(result.edges)) {
			throw new Error('Response missing required "edges" array');
		}

		// Validate each node has a type
		for (const node of result.nodes) {
			if (!node.type) {
				throw new Error('Node missing required "type" field');
			}
		}

		console.log('[AI Multi-Object Generator] Parsed result:', result);
		console.log('[AI Multi-Object Generator] Nodes count:', result.nodes.length);
		console.log('[AI Multi-Object Generator] Edges count:', result.edges.length);

		return {
			nodes: result.nodes,
			edges: result.edges
		};
	} catch (error) {
		console.error('Failed to parse generation response:', error);
		console.log('Response text:', responseText);
		throw new Error('Failed to parse generation response as JSON');
	}
}

/**
 * Builds the multi-object router prompt - lightweight, only object descriptions
 */
function buildMultiObjectRouterPrompt(): string {
	return `You are an AI assistant that plans multi-object configurations in Patchies, a visual patching environment for creative coding.

Your task: Read the user's prompt and determine:
1. Which object types are needed
2. How they should connect (structure description)

Return ONLY a JSON object with this format:
{
  "objectTypes": ["type1", "type2", ...],
  "structure": "brief description of connections (e.g., 'slider controls osc~ frequency')"
}

AVAILABLE OBJECT TYPES:

${OBJECT_TYPE_LIST}

EXAMPLES:

User: "slider controlling oscillator frequency"
Response:
{
  "objectTypes": ["slider", "tone~"],
  "structure": "slider connects to tone~ oscillator frequency inlet"
}

User: "button that triggers a visual animation"
Response:
{
  "objectTypes": ["button", "p5"],
  "structure": "button sends bang to p5 sketch to trigger animation"
}

User: "XY pad controlling two parameters"
Response:
{
  "objectTypes": ["canvas.dom", "expr", "expr"],
  "structure": "XY pad outputs [x, y] array, split by two expr objects for separate parameter control"
}

Now analyze this prompt:`;
}

/**
 * Builds the multi-object generator prompt - targeted for specific object types
 */
function buildMultiObjectGeneratorPrompt(
	objectTypes: string[],
	structure: string
): string {
	// Get object-specific instructions for each type
	const objectInstructions = objectTypes
		.map((type) => getObjectSpecificInstructions(type))
		.join('\n\n---\n\n');

	return `You are an AI assistant that generates multiple connected object configurations in Patchies, a visual patching environment for creative coding.

Your task: Create a complete multi-object configuration based on the plan.

PLAN:
- Object types needed: ${objectTypes.join(', ')}
- Structure: ${structure}

IMPORTANT RULES:
1. You MUST respond with ONLY a valid JSON object, nothing else
2. The JSON must have a "nodes" array and an "edges" array
3. Each node in the "nodes" array must have a "type" field and a "data" field
4. Each node SHOULD have a "position" field with relative x, y coordinates for good visual layout
5. Position nodes in a TOP-TO-BOTTOM flow (like PureData): sources on top (y: 0), outputs on bottom (y: 150+)
6. Use horizontal spacing (x: 0, x: 250, x: 500) when nodes connect to the same target in parallel
7. Each edge in the "edges" array connects nodes by their index in the nodes array
8. Edges use "source" (node index), "target" (node index), and optionally "sourceHandle" and "targetHandle"
9. CRITICAL - Handle ID rules (these MUST be exact):
   - If node has ONLY ONE port of that type: use "{type}-{direction}" (e.g., "message-out", "audio-in")
   - If node has MULTIPLE ports of same type: use "{type}-{direction}-{index}" (e.g., "message-out-0", "audio-in-1")
   - Most simple nodes (slider, button, toggle, msg) have single ports, so use: "message-out", "message-in"
   - Direction: "out" for outlets/sources, "in" for inlets/targets
   - Examples:
     * slider → tone~: sourceHandle: "message-out", targetHandle: "message-in"
     * tone~ (with 2 audio ins) → dac~: sourceHandle: "audio-out", targetHandle: "audio-in-0"
10. Focus on creating FUNCTIONAL, CONNECTED systems
11. ALWAYS include appropriate code and helper functions for each object type

RESPONSE FORMAT:
{
  "nodes": [
    {
      "type": "objectType",
      "data": { /* object configuration */ },
      "position": { "x": 0, "y": 0 }
    }
  ],
  "edges": [
    {
      "source": 0,
      "target": 1,
      "sourceHandle": "message-out",
      "targetHandle": "message-in"
    }
  ]
}

LAYOUT EXAMPLE (top-to-bottom like PureData):
- slider at top: { "position": { "x": 0, "y": 0 } }
- tone~ below: { "position": { "x": 0, "y": 150 } }
- If parallel inputs, use horizontal spacing:
  - slider1: { "x": 0, "y": 0 }
  - slider2: { "x": 250, "y": 0 }
  - both connect to node below: { "x": 125, "y": 150 }

OBJECT-SPECIFIC INSTRUCTIONS:

${objectInstructions}

Now generate the multi-object configuration.`;
}
