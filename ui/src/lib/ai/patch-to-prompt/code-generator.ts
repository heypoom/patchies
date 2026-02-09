/**
 * AI-powered code generation using Gemini.
 *
 * Takes a refined specification and generates a complete HTML file
 * that can be previewed in an iframe.
 */

export interface GenerateOptions {
  signal?: AbortSignal;
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

  const { signal } = options;

  if (signal?.aborted) {
    throw new Error('Request cancelled');
  }

  const { GoogleGenAI } = await import('@google/genai');
  const ai = new GoogleGenAI({ apiKey });

  const prompt = buildGeneratePrompt(specification);

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    config: { abortSignal: signal }
  });

  const text = response.text;

  if (!text) {
    throw new Error('No response from AI');
  }

  // Extract HTML from response (handle markdown code blocks)
  return extractHtml(text.trim());
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
