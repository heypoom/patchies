/**
 * AI-powered code generation using Gemini.
 *
 * Takes a refined specification and generates a complete HTML file
 * that can be previewed in an iframe.
 */

export interface GenerateOptions {
  signal?: AbortSignal;
  onThinking?: (thought: string) => void;
}

export interface EditOptions {
  signal?: AbortSignal;
  onThinking?: (thought: string) => void;
}

/**
 * Generates a complete HTML file from a specification using Gemini AI.
 *
 * The output is a single, self-contained HTML file with embedded CSS and JS.
 */
export async function generateCode(
  specification: string,
  options: GenerateOptions = {}
): Promise<string> {
  const apiKey = localStorage.getItem('gemini-api-key');

  if (!apiKey) {
    throw new Error('Gemini API key is not set. Please set it in the settings.');
  }

  const { signal, onThinking } = options;

  if (signal?.aborted) {
    throw new Error('Request cancelled');
  }

  const { GoogleGenAI } = await import('@google/genai');
  const ai = new GoogleGenAI({ apiKey });

  const prompt = buildGeneratePrompt(specification);

  // Use streaming with thinking enabled for real-time feedback
  const response = await ai.models.generateContentStream({
    model: 'gemini-3-flash-preview',
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    config: {
      thinkingConfig: {
        includeThoughts: true
      }
    }
  });

  let responseText = '';

  for await (const chunk of response) {
    // Check for cancellation during streaming
    if (signal?.aborted) {
      throw new Error('Request cancelled');
    }

    for (const part of chunk.candidates?.[0]?.content?.parts ?? []) {
      if (part.thought && part.text && onThinking) {
        // Stream thinking updates to UI
        onThinking(part.text);
      } else if (part.text) {
        // Accumulate final response text
        responseText += part.text;
      }
    }
  }

  if (!responseText.trim()) {
    throw new Error('No response from AI');
  }

  // Extract HTML from response (handle markdown code blocks)
  return extractHtml(responseText.trim());
}

/**
 * Edits an existing HTML file based on a user prompt using Gemini AI.
 *
 * Takes the current HTML and a prompt describing what to change,
 * returns the modified HTML.
 */
export async function editCode(
  currentHtml: string,
  editPrompt: string,
  options: EditOptions = {}
): Promise<string> {
  const apiKey = localStorage.getItem('gemini-api-key');

  if (!apiKey) {
    throw new Error('Gemini API key is not set. Please set it in the settings.');
  }

  const { signal, onThinking } = options;

  if (signal?.aborted) {
    throw new Error('Request cancelled');
  }

  const { GoogleGenAI } = await import('@google/genai');
  const ai = new GoogleGenAI({ apiKey });

  const prompt = buildEditPrompt(currentHtml, editPrompt);

  // Use streaming with thinking enabled for real-time feedback
  const response = await ai.models.generateContentStream({
    model: 'gemini-3-flash-preview',
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    config: {
      thinkingConfig: {
        includeThoughts: true
      }
    }
  });

  let responseText = '';

  for await (const chunk of response) {
    // Check for cancellation during streaming
    if (signal?.aborted) {
      throw new Error('Request cancelled');
    }

    for (const part of chunk.candidates?.[0]?.content?.parts ?? []) {
      if (part.thought && part.text && onThinking) {
        // Stream thinking updates to UI
        onThinking(part.text);
      } else if (part.text) {
        // Accumulate final response text
        responseText += part.text;
      }
    }
  }

  if (!responseText.trim()) {
    throw new Error('No response from AI');
  }

  // Extract HTML from response (handle markdown code blocks)
  return extractHtml(responseText.trim());
}

/**
 * Builds the prompt for code generation.
 */
function buildGeneratePrompt(specification: string): string {
  return `You are an expert web developer. Generate a complete, self-contained HTML file based on the following specification.

**Requirements:**
- Output ONLY the HTML code, no explanations
- Single HTML file with embedded <style> and <script> tags
- Use modern CSS (flexbox/grid) and vanilla JavaScript
- Include all necessary CDN links (e.g., Three.js, Tone.js, p5.js) if needed
- Dark theme by default (dark background, light text)
- Responsive design that works on mobile and desktop
- Clean, well-commented code

**Specification:**

${specification}

**Output the complete HTML file now:**`;
}

/**
 * Builds the prompt for editing existing HTML.
 */
function buildEditPrompt(currentHtml: string, editPrompt: string): string {
  return `You are an expert web developer. Edit the following HTML file based on the user's instructions.

**Requirements:**
- Output ONLY the complete modified HTML code, no explanations
- Keep the same structure and style unless asked to change it
- Preserve existing functionality unless asked to modify it
- Make minimal changes to achieve the requested result

**Current HTML:**

\`\`\`html
${currentHtml}
\`\`\`

**User's edit request:**

${editPrompt}

**Output the complete modified HTML file now:**`;
}

/**
 * Extracts HTML from the AI response, handling markdown code blocks.
 */
function extractHtml(text: string): string {
  // Try to extract from markdown code block
  const htmlBlockMatch = text.match(/```html?\s*([\s\S]*?)```/i);
  if (htmlBlockMatch) {
    return htmlBlockMatch[1].trim();
  }

  // Try to extract from generic code block
  const codeBlockMatch = text.match(/```\s*([\s\S]*?)```/);
  if (codeBlockMatch) {
    const content = codeBlockMatch[1].trim();
    // Check if it looks like HTML
    if (content.includes('<!DOCTYPE') || content.includes('<html') || content.includes('<head')) {
      return content;
    }
  }

  // If the response starts with DOCTYPE or html tag, use as-is
  if (text.includes('<!DOCTYPE') || text.startsWith('<html')) {
    return text;
  }

  // Last resort: return as-is and hope for the best
  return text;
}
