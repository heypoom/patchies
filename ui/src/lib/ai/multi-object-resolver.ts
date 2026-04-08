/**
 * Multi-object resolution using two-stage AI approach.
 * 1. Router call: Determines which object types to use and how they connect (lightweight)
 * 2. Generator call: Generates the full object configurations (targeted)
 *
 * Handle IDs are auto-generated from ObjectSchema handle specs via generateHandleDocs().
 * See spec 99 (Schema-Driven Handles) for architecture details.
 */

import { OBJECT_TYPE_LIST } from './object-descriptions';
import { buildMultiObjectInstructionParts } from './object-prompts/build-generator-instructions';
import { generateHandleDocs } from './generate-handle-docs';
import { extractJson } from './extract-json';
import { getTextProvider } from './providers';
import type { LLMProvider } from './providers';

// Consolidated logging for AI Multi-Object debugging
class MultiObjectLogger {
  private logs: string[] = [];

  log(message: string, data?: unknown) {
    if (data !== undefined) {
      this.logs.push(`${message}: ${JSON.stringify(data, null, 2)}`);
    } else {
      this.logs.push(message);
    }
  }

  flush() {
    if (this.logs.length === 0) return;

    const consolidated = `
╔════════════════════════════════════════════════════════════════╗
║           [AI Multi-Object] Consolidated Debug Log             ║
╚════════════════════════════════════════════════════════════════╝

${this.logs.join('\n\n')}

════════════════════════════════════════════════════════════════
`;
    console.log(consolidated);
    this.logs = [];
  }

  error(message: string, error?: unknown) {
    if (error) {
      this.logs.push(
        `❌ ${message}: ${error instanceof Error ? error.message : JSON.stringify(error)}`
      );
    } else {
      this.logs.push(`❌ ${message}`);
    }
  }
}

const logger = new MultiObjectLogger();

// Import and re-export shared types
import type { SimplifiedEdge, MultiObjectResult, AiObjectNode } from './types';
export type { SimplifiedEdge, MultiObjectResult, AiObjectNode };

/**
 * Uses Gemini AI to resolve a natural language prompt to multiple connected objects.
 * Uses a two-call approach:
 * 1. Router call: Determines which object types to use and how they connect (lightweight)
 * 2. Generator call: Generates the full object configurations (targeted)
 *
 * Accepts optional callback to report progress between calls for better UX.
 * Supports cancellation via AbortSignal.
 */
export async function resolveMultipleObjectsFromPrompt(
  prompt: string,
  onRouterComplete?: (objectTypes: string[]) => void,
  signal?: AbortSignal,
  onThinking?: (thought: string) => void
): Promise<MultiObjectResult | null> {
  // Check for cancellation before starting
  if (signal?.aborted) {
    throw new Error('Request cancelled');
  }

  const provider = getTextProvider();

  logger.log('📝 Starting multi-object resolution');
  logger.log('User prompt', prompt);

  // Call 1: Route to object types and structure (lightweight)
  const plan = await routeToMultiObjectPlan(provider, prompt, signal, onThinking);
  if (!plan) {
    logger.log('⚠️ Router returned no plan');
    logger.flush();
    return null;
  }

  // Check for cancellation after first call
  if (signal?.aborted) {
    throw new Error('Request cancelled');
  }

  // Report router completion to UI
  onRouterComplete?.(plan.objectTypes);

  // Call 2: Generate full object configs (targeted)
  const result = await generateMultiObjectConfig(provider, prompt, plan, signal, onThinking);

  logger.flush();

  return result;
}

/**
 * Call 1 (Multi-object): Routes to object types and determines connection structure.
 * This is a lightweight call that only includes object descriptions.
 */
async function routeToMultiObjectPlan(
  provider: LLMProvider,
  prompt: string,
  signal?: AbortSignal,
  onThinking?: (thought: string) => void
): Promise<{ objectTypes: string[]; structure: string } | null> {
  if (signal?.aborted) throw new Error('Request cancelled');

  const routerPrompt = buildMultiObjectRouterPrompt();

  const responseText = await provider.generateText(
    [{ role: 'user', content: `${routerPrompt}\n\nUser prompt: "${prompt}"` }],
    { signal, onThinking }
  );

  if (!responseText.trim()) {
    logger.log('⚠️ Router response is empty');
    return null;
  }

  try {
    const jsonText = extractJson(responseText.trim());
    const result = JSON.parse(jsonText);

    if (!result.objectTypes || !Array.isArray(result.objectTypes)) {
      throw new Error('Response missing required "objectTypes" array');
    }

    if (!result.structure) {
      throw new Error('Response missing required "structure" field');
    }

    logger.log('✅ [Router] Object types', result.objectTypes);
    logger.log('✅ [Router] Connection structure', result.structure);

    return result;
  } catch (error) {
    logger.error('[Router] Failed to parse response', error);
    logger.log('Raw response text', responseText);
    throw new Error('Failed to parse routing response as JSON');
  }
}

/**
 * Call 2 (Multi-object): Generates full object configurations based on the plan.
 */
async function generateMultiObjectConfig(
  provider: LLMProvider,
  prompt: string,
  plan: { objectTypes: string[]; structure: string },
  signal?: AbortSignal,
  onThinking?: (thought: string) => void
): Promise<MultiObjectResult | null> {
  if (signal?.aborted) throw new Error('Request cancelled');

  const systemPrompt = buildMultiObjectGeneratorPrompt(plan.objectTypes, plan.structure);

  const responseText = await provider.generateText(
    [{ role: 'user', content: `${systemPrompt}\n\nUser prompt: "${prompt}"` }],
    { signal, onThinking }
  );

  if (!responseText.trim()) {
    logger.log('⚠️ Generator response is empty');
    return null;
  }

  try {
    const jsonText = extractJson(responseText.trim());
    const result = JSON.parse(jsonText);

    if (!result.nodes || !Array.isArray(result.nodes)) {
      throw new Error('Response missing required "nodes" array');
    }

    if (!result.edges || !Array.isArray(result.edges)) {
      throw new Error('Response missing required "edges" array');
    }

    for (const node of result.nodes) {
      if (!node.type) throw new Error('Node missing required "type" field');
    }

    logger.log('✅ [Generator] Successfully parsed result');
    logger.log('✅ [Generator] Nodes created', result.nodes);
    logger.log('✅ [Generator] Edges created', result.edges);

    return { nodes: result.nodes, edges: result.edges };
  } catch (error) {
    logger.error('[Generator] Failed to parse response', error);
    logger.log('Raw response text', responseText);
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

User: "generative texture feeding into a GLSL shader"
Response:
{
  "objectTypes": ["canvas", "glsl"],
  "structure": "canvas generates offscreen texture, piped into glsl as video input for shader processing"
}

User: "heavy particle simulation with 10000 particles"
Response:
{
  "objectTypes": ["canvas"],
  "structure": "canvas runs computationally heavy particle simulation on web worker for performance"
}

User: "XY pad controlling two parameters"
Response:
{
  "objectTypes": ["canvas.dom", "expr", "expr"],
  "structure": "XY pad outputs [x, y] array, split by two expr objects for separate parameter control"
}

User: "808 drum machine with kick and snare"
Response:
{
  "objectTypes": ["button", "button", "tone~", "tone~", "object"],
  "structure": "Two buttons trigger two tone~ drum sounds (kick and snare), both connect to object (out~) for speaker output"
}

IMPORTANT: For audio output to speakers, use "object" type (which will create out~), NOT "out~" as a direct type.

CHOOSING BETWEEN p5 / canvas / canvas.dom for visuals:
- p5: shorter, readable programs where code clarity matters; great for interactive sketches using p5's own mouse/keyboard helpers
- canvas: runs on a web worker (offscreen, no DOM access, no interactivity) — highest performance; best when chaining into the rendering pipeline (e.g. as a video texture for glsl/hydra) or when no interactivity is needed
- canvas.dom: runs on main thread so it can handle mouse/keyboard input and DOM access; more verbose than p5 but lower overhead; best for computationally heavy visuals or complex cases that need interactivity without p5's abstraction layer

SPEED/PERFORMANCE KEYWORDS ("fast", "smooth", "60fps", "performant", "optimized", "efficient"):
- If the user asks for speed/performance AND no interactivity → canvas (web worker, highest perf)
- If the user asks for speed/performance AND needs mouse/keyboard → canvas.dom
- Never choose p5 when performance is explicitly requested

Now analyze this prompt:`;
}

/**
 * Builds the multi-object generator prompt - targeted for specific object types
 */
function buildMultiObjectGeneratorPrompt(objectTypes: string[], structure: string): string {
  // Build all instruction sections at once (deduplicates shared sections)
  const { jsInstructions, uiDesignInstructions, glslImportInstructions, objectInstructions } =
    buildMultiObjectInstructionParts(objectTypes);

  // Generate handle ID reference from schemas for the requested object types
  const uniqueObjectTypes = [...new Set(objectTypes)];
  const handleDocs = generateHandleDocs(uniqueObjectTypes);

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
5. Position nodes in a TOP-TO-BOTTOM flow (like Pd): sources on top (y: 0), outputs at the bottom (y: 160+)
6. Use plenty of horizontal spacing (x: 0, x: 350, x: 700, x: 1050) for side-by-side or parallel nodes, so they don't overlap.
7. Vertical steps should be at least 160-200 pixels between rows for a more compact layout
8. Calculate spacing based on signal flow depth: sources at y=0, first processing stage y=180, next y=360, outputs y=540+
9. Each edge in the "edges" array connects nodes by their index in the nodes array
10. Edges use "source" (node index), "target" (node index), and optionally "sourceHandle" and "targetHandle"
11. ${handleDocs ? 'CRITICAL: Use the exact handle IDs from the HANDLE ID REFERENCE below. These are auto-generated from schemas and MUST match exactly.' : 'Use standard handle ID patterns: audio-in-{N}/audio-out-{N} for signal ports, message-in-{N}/message-out-{N} for message ports.'}
12. For GLSL uniform inlets, omit targetHandle — the framework auto-fills it.
13. out~ has ONE audio inlet "audio-in-0". Multiple sources connect to the SAME inlet (Web Audio auto-mixes). Do NOT create separate out~ nodes per source.
14. Focus on creating FUNCTIONAL, CONNECTED systems
15. ALWAYS include appropriate code and helper functions for each object type
16. CRITICAL for shader graphs: Space GLSL nodes generously (y: 0, y: 350, y: 700, y: 1050) with 350+ pixel gaps

${handleDocs}

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
      "sourceHandle": "<see HANDLE ID REFERENCE>",
      "targetHandle": "<see HANDLE ID REFERENCE>"
    }
  ]
}

LAYOUT EXAMPLE (top-to-bottom like Pd with generous spacing):
- slider at top: { "position": { "x": 0, "y": 0 } }
- tone~ below: { "position": { "x": 0, "y": 300 } } (300px gap minimum!)
- If parallel inputs, use GENEROUS horizontal spacing:
  - slider1: { "x": 0, "y": 0 }
  - slider2: { "x": 350, "y": 0 } (350px apart minimum)
  - button: { "x": 700, "y": 0 } (700px from slider1)
  - all connect to processor below: { "x": 350, "y": 300 } (centered, 300px down)

OBJECT-SPECIFIC INSTRUCTIONS:

${jsInstructions}${uiDesignInstructions}${glslImportInstructions}${objectInstructions}

Now generate the multi-object configuration.`;
}
