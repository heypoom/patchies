import { getObjectSpecificInstructions } from '../object-descriptions';
import { JS_ENABLED_OBJECTS, jsRunnerInstructions } from '../object-prompts/shared-jsrunner';

export interface ChatMessage {
  role: 'user' | 'model';
  content: string;
  thinking?: string;
}

export interface ChatNodeContext {
  nodeType: string;
  nodeData?: Record<string, unknown>;
}

const SYSTEM_PROMPT = `You are a helpful AI assistant embedded in Patchies, a visual node-based programming environment for audio-visual creative coding. Users connect nodes (P5.js, Hydra, Strudel, GLSL, JavaScript, audio DSP objects) to build real-time audio-visual patches.

Help with:
- Writing and debugging code for node types (P5.js, Hydra, GLSL shaders, JavaScript, audio DSP, etc.)
- Node connections, signal routing, and patch architecture
- Audio DSP concepts (oscillators, filters, envelopes, effects)
- Creative coding techniques and algorithms

Keep answers concise and practical. Format code for the relevant node type.`;

/**
 * Streams a chat message response using Gemini. Calls onChunk for each
 * streamed text part and returns the full accumulated response.
 */
export async function streamChatMessage(
  messages: ChatMessage[],
  nodeContext: ChatNodeContext | null,
  onChunk: (text: string) => void,
  signal?: AbortSignal,
  onThinking?: (thought: string) => void
): Promise<string> {
  const apiKey = localStorage.getItem('gemini-api-key');

  if (!apiKey) {
    throw new Error('Gemini API key is not set. Please set it in the settings.');
  }

  if (signal?.aborted) {
    throw new Error('Request cancelled');
  }

  const { GoogleGenAI } = await import('@google/genai');
  const ai = new GoogleGenAI({ apiKey });

  let systemInstruction = SYSTEM_PROMPT;
  if (nodeContext) {
    systemInstruction += `\n\nThe user is currently working with a "${nodeContext.nodeType}" node.`;

    if (nodeContext.nodeData && Object.keys(nodeContext.nodeData).length > 0) {
      try {
        // Serialize only — non-serializable values (e.g. AudioNode instances) will be dropped
        const serialized = JSON.stringify(nodeContext.nodeData, null, 2);
        systemInstruction += `\nCurrent node data:\n${serialized}`;
      } catch {
        // ignore if data isn't serializable
      }
    }

    // Inject the same object-specific instructions used by the AI object resolver
    if (JS_ENABLED_OBJECTS.has(nodeContext.nodeType)) {
      systemInstruction += `\n\n## JSRunner Runtime Functions\n\n${jsRunnerInstructions}`;
    }

    const objectInstructions = getObjectSpecificInstructions(nodeContext.nodeType);
    if (objectInstructions) {
      systemInstruction += `\n\n## ${nodeContext.nodeType} Reference\n\n${objectInstructions}`;
    }
  }

  const contents = messages.map((msg) => ({
    role: msg.role,
    parts: [{ text: msg.content }]
  }));

  const response = await ai.models.generateContentStream({
    model: 'gemini-3-flash-preview',
    contents,
    config: {
      systemInstruction,
      thinkingConfig: { includeThoughts: true }
    }
  });

  let fullText = '';

  for await (const chunk of response) {
    if (signal?.aborted) {
      throw new Error('Request cancelled');
    }

    for (const part of chunk.candidates?.[0]?.content?.parts ?? []) {
      if (part.thought) {
        if (part.text && onThinking) onThinking(part.text);
      } else if (part.text) {
        fullText += part.text;
        onChunk(part.text);
      }
    }
  }

  return fullText;
}
