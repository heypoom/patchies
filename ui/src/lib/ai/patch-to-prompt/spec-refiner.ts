/**
 * AI-powered spec refinement using Gemini.
 *
 * Takes the raw patch data and steering prompt, then generates a clean,
 * human-readable specification that can be used to recreate the patch
 * functionality in a standalone project.
 */

import type { CleanedPatch } from './patch-transformer';
import { getImplementationHints, getBriefDescriptions } from './context-injector';

export interface RefineOptions {
  patchName?: string;
  steeringPrompt?: string;
  signal?: AbortSignal;
}

/**
 * Refines a patch into a clean, human-readable specification using Gemini AI.
 *
 * The output focuses on:
 * - Clear software requirements
 * - Data flow description in plain English
 * - Implementation guidance without raw JSON
 * - Tailoring to the user's steering prompt
 */
export async function refineSpec(
  patch: CleanedPatch,
  options: RefineOptions = {}
): Promise<string> {
  const apiKey = localStorage.getItem('gemini-api-key');

  if (!apiKey) {
    throw new Error('Gemini API key is not set. Please set it in the settings.');
  }

  const { signal } = options;

  // Check for cancellation before starting
  if (signal?.aborted) {
    throw new Error('Request cancelled');
  }

  const { GoogleGenAI } = await import('@google/genai');
  const ai = new GoogleGenAI({ apiKey });

  const prompt = buildRefinePrompt(patch, options);

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    config: { abortSignal: signal }
  });

  const text = response.text;

  if (!text) {
    throw new Error('No response from AI');
  }

  return text.trim();
}

/** Map node types to syntax highlighting language (only for non-JS languages) */
const LANGUAGE_MAP: Record<string, string> = {
  glsl: 'glsl',
  python: 'python'
};

/**
 * Extracts code blocks from nodes that have a `code` field in their data.
 * Works automatically for any node type - no need to maintain a list.
 */
function extractCodeBlocks(
  nodes: CleanedPatch['nodes']
): Array<{ type: string; id: string; code: string; language: string }> {
  const codeBlocks: Array<{ type: string; id: string; code: string; language: string }> = [];

  for (const node of nodes) {
    // @ts-expect-error -- only some node has code
    const code = node.data?.code;
    if (typeof code !== 'string' || !code.trim()) continue;

    codeBlocks.push({
      type: node.type,
      id: node.id,
      code: code.trim(),
      language: LANGUAGE_MAP[node.type] ?? 'javascript'
    });
  }

  return codeBlocks;
}

/**
 * Builds the prompt for the AI to refine the spec.
 */
function buildRefinePrompt(patch: CleanedPatch, options: RefineOptions): string {
  const { patchName, steeringPrompt } = options;
  const { metadata, nodes, edges } = patch;

  const hints = getImplementationHints(metadata.nodeTypes);
  const descriptions = getBriefDescriptions(metadata.nodeTypes);
  const codeBlocks = extractCodeBlocks(nodes);

  const sections: string[] = [];

  // Introduction - with code preservation instruction if needed
  const hasCode = codeBlocks.length > 0;
  sections.push(`You are helping a user convert a visual programming patch into a clean software specification.

Your task is to create a **human-readable specification** that developers can use to implement the same functionality in a standalone web project (HTML/CSS/JS).

**Important guidelines:**
- Write in clear, professional technical prose
- Focus on WHAT the software should do, not the patch's internal structure
- Convert the data flow graph into natural language descriptions
- Include specific implementation hints for the technologies involved
- Make it actionable for a developer who has never seen the original patch
- Do NOT include raw JSON or patch node IDs in the output${hasCode ? '\n- **IMPORTANT**: Preserve all source code exactly as provided - this contains the core business logic' : ''}
- Keep it concise but complete`);

  // User's steering prompt (their vision)
  if (steeringPrompt?.trim()) {
    sections.push(`## User's Vision

The user described what they want to build:
"${steeringPrompt.trim()}"

Incorporate this vision into the specification.`);
  }

  // Patch overview
  const title = patchName ? `"${patchName}"` : 'Untitled Patch';
  sections.push(`## Patch Information

- **Name**: ${title}
- **Components**: ${metadata.nodeCount} nodes, ${metadata.edgeCount} connections
- **Technologies used**: ${metadata.nodeTypes.join(', ')}`);

  // Node descriptions
  if (Object.keys(descriptions).length > 0) {
    sections.push(`## Component Types

${Object.entries(descriptions)
  .map(([type, desc]) => `- **${type}**: ${desc}`)
  .join('\n')}`);
  }

  // Implementation hints
  if (hints.length > 0) {
    sections.push(`## Technical Requirements

${hints.map((hint) => `- ${hint}`).join('\n')}`);
  }

  // Data flow - provide structured info for AI to interpret
  sections.push(`## Data Flow (Raw)

Here is the patch structure for you to interpret and describe in natural language:

**Nodes:**
${nodes.map((n) => `- ${n.type} (id: ${n.id}): ${JSON.stringify(n.data)}`).join('\n')}

**Connections:**
${edges.map((e) => `- ${e.source}${e.sourceHandle ? `:${e.sourceHandle}` : ''} → ${e.target}${e.targetHandle ? `:${e.targetHandle}` : ''}`).join('\n')}`);

  // Source code blocks - preserve these exactly
  if (codeBlocks.length > 0) {
    const codeSection = codeBlocks
      .map(
        (block) => `### ${block.type} node
\`\`\`${block.language}
${block.code}
\`\`\``
      )
      .join('\n\n');

    sections.push(`## Source Code (PRESERVE EXACTLY)

The following code blocks contain the core business logic. Include them in your specification exactly as written:

${codeSection}`);
  }

  // Output format instructions
  const outputSections = [
    '1. **Overview** - One paragraph summary of what this software does',
    '2. **Features** - Bullet list of key features/behaviors',
    '3. **User Interface** - Description of the UI elements and layout',
    '4. **Data Flow** - How data moves through the system (in plain English)',
    '5. **Technical Implementation** - Specific libraries, APIs, and patterns to use'
  ];

  if (codeBlocks.length > 0) {
    outputSections.push('6. **Source Code** - Include all code blocks exactly as provided above');
    outputSections.push(
      '7. **Example Usage** - A brief scenario of how a user would interact with it'
    );
  } else {
    outputSections.push(
      '6. **Example Usage** - A brief scenario of how a user would interact with it'
    );
  }

  sections.push(`## Your Output

Generate a specification document with these sections:

${outputSections.join('\n')}

Write the specification now:`);

  return sections.join('\n\n');
}

/**
 * Checks if the Gemini API key is available.
 */
export function hasGeminiApiKey(): boolean {
  return !!localStorage.getItem('gemini-api-key');
}
