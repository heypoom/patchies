/**
 * Edit object resolver - skips routing since we already know the object type.
 * This is more efficient for edit operations.
 */

import { extractJson } from './extract-json';
import { buildObjectTypeInstructions } from './object-prompts/build-generator-instructions';
import { getTextProvider } from './providers';
import type { LLMProvider } from './providers';

/**
 * Edit an existing object with a known type - skips routing, goes directly to generation.
 * This is more efficient for edit operations since we already know the object type.
 */
export async function editObjectFromPrompt(
  prompt: string,
  objectType: string,
  existingData?: Record<string, unknown>,
  signal?: AbortSignal,
  onThinking?: (thought: string) => void
): Promise<{
  type: string;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- fixme
  data: any;
} | null> {
  if (signal?.aborted) throw new Error('Request cancelled');

  const provider = getTextProvider();

  let enhancedPrompt = prompt;
  if (existingData && Object.keys(existingData).length > 0) {
    const dataString = JSON.stringify(existingData, null, 2);
    enhancedPrompt = `Modify this existing ${objectType} object. Current data:\n${dataString}\n\nUser request: ${prompt}`;
  } else {
    enhancedPrompt = `Modify this existing ${objectType} object. User request: ${prompt}`;
  }

  return generateObjectConfig(provider, enhancedPrompt, objectType, signal, onThinking);
}

async function generateObjectConfig(
  provider: LLMProvider,
  prompt: string,
  objectType: string,
  signal?: AbortSignal,
  onThinking?: (thought: string) => void
): Promise<{
  type: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- fixme
  data: any;
} | null> {
  if (signal?.aborted) throw new Error('Request cancelled');

  const systemPrompt = buildGeneratorPrompt(objectType);

  const responseText = await provider.generateText(
    [{ role: 'user', content: `${systemPrompt}\n\nUser prompt: "${prompt}"` }],
    { signal, onThinking }
  );

  if (!responseText.trim()) return null;

  try {
    const jsonText = extractJson(responseText.trim());
    const result = JSON.parse(jsonText);

    if (!result.type) throw new Error('Response missing required "type" field');

    return { type: result.type, data: result.data || {} };
  } catch (error) {
    console.error('Failed to parse AI response:', error);

    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to parse AI response: ${reason}`);
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

  const objectInstructions = buildObjectTypeInstructions(objectType);

  return basePrompt + objectInstructions;
}
