/**
 * Tool declarations and constants for the chat resolver.
 *
 * Extracted from resolver.ts to keep the streaming logic readable.
 */

import { OBJECT_TYPE_LIST } from '../object-descriptions-types';

// ── System prompt ─────────────────────────────────────────────────────────────

export const SYSTEM_PROMPT = `You are a helpful AI assistant embedded in Patchies, a visual node-based programming environment for audio-visual creative coding. Users connect nodes (P5.js, Hydra, Strudel, GLSL, JavaScript, audio DSP objects) to build real-time audio-visual patches.

Help with:
- Writing and debugging code for node types (P5.js, Hydra, GLSL shaders, JavaScript, audio DSP, etc.)
- Node connections, signal routing, and patch architecture
- Audio DSP concepts (oscillators, filters, envelopes, effects)
- Creative coding techniques and algorithms

You have canvas tools to create, edit, replace, or fix nodes on the user's behalf.
However, NEVER use these tools unless the user has explicitly asked you to create, modify, or fix something.
If the user is just asking a question, exploring ideas, or having a conversation, respond with text only.
Do not proactively create objects or visualizations.
You can suggest simulation or visualization ideas in your text response, but wait until user has consented to it.

## Tool Selection Priority

When the user asks you to act on the canvas, always prefer the **simplest** tool that accomplishes the task:

1. **edit** — If a node already exists and the user wants changes, ALWAYS use edit. Never recreate an object that already exists.
2. **insert** (single create) — If the user needs ONE new object, use insert. Do NOT use multi just because a description is detailed.
3. **multi** (multi create) — ONLY use this when the user explicitly asks for multiple connected objects, or the task fundamentally requires more than one node working together.

Common mistakes to avoid:
- Do NOT use multi to create a single object. Even complex objects (e.g. "a synthesizer with LFO modulation") should use insert if it's one node.
- Do NOT recreate objects that already exist on the canvas. Use edit or fix_error instead.
- When the user says "make X" or "create X" (singular), default to insert unless they clearly need multiple nodes.

Keep answers concise and practical. Format code for the relevant node type.

## Available Object Types

${OBJECT_TYPE_LIST}`;

// ── Context tool names ────────────────────────────────────────────────────────

export const GET_OBJECT_INSTRUCTIONS = 'get_object_instructions';
export const GET_GRAPH_NODES = 'get_graph_nodes';
export const GET_NODE_DATA = 'get_node_data';
export const SEARCH_DOCS = 'search_docs';
export const GET_DOC_CONTENT = 'get_doc_content';
export const CONNECT_EDGES = 'connect_edges';

export const CONTEXT_TOOL_NAMES = new Set([
  GET_OBJECT_INSTRUCTIONS,
  GET_GRAPH_NODES,
  GET_NODE_DATA,
  SEARCH_DOCS,
  GET_DOC_CONTENT
]);

// ── Context tool declarations ─────────────────────────────────────────────────

export const contextToolDeclarations = [
  {
    name: GET_OBJECT_INSTRUCTIONS,
    description:
      'Fetch detailed instructions and API reference for a specific Patchies object type. Call this before writing code for a type you need more details about.',
    parametersJsonSchema: {
      type: 'object',
      properties: {
        type: {
          type: 'string',
          description: 'The object type (e.g. "p5", "glsl", "tone~", "strudel")'
        }
      },
      required: ['type']
    }
  },
  {
    name: GET_GRAPH_NODES,
    description:
      'List all nodes currently on the canvas with their id, type, and name. Use this to discover what nodes exist before referencing them in canvas actions.',
    parametersJsonSchema: { type: 'object', properties: {} }
  },
  {
    name: GET_NODE_DATA,
    description: 'Fetch the full data of a specific node by its ID.',
    parametersJsonSchema: {
      type: 'object',
      properties: {
        nodeId: { type: 'string', description: 'The node ID to fetch data for' }
      },
      required: ['nodeId']
    }
  },
  {
    name: SEARCH_DOCS,
    description:
      'Search available documentation by keyword. Returns matching topic guides and object reference pages with metadata. Call this to discover relevant docs before fetching content.',
    parametersJsonSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search query (matches title, slug, category, description, tags)'
        }
      },
      required: ['query']
    }
  },
  {
    name: GET_DOC_CONTENT,
    description:
      'Fetch the full markdown content of a documentation page. Use search_docs first to find the correct slug.',
    parametersJsonSchema: {
      type: 'object',
      properties: {
        kind: {
          type: 'string',
          enum: ['topic', 'object'],
          description: '"topic" for guide pages, "object" for object reference pages'
        },
        slug: {
          type: 'string',
          description:
            'For topics: the topic slug (e.g. "adding-objects"). For objects: the object type (e.g. "p5", "gain~")'
        }
      },
      required: ['kind', 'slug']
    }
  }
];

// ── Connect edges declaration ─────────────────────────────────────────────────

export const connectEdgesDeclaration = {
  name: CONNECT_EDGES,
  description:
    'Connect existing nodes on the canvas by creating edges between them. Use get_graph_nodes first to discover node IDs. Handle IDs follow the pattern: type-direction (e.g. "message-out", "audio-in", "video-out") or direction-index (e.g. "in-0", "out-1") for indexed ports.',
  parametersJsonSchema: {
    type: 'object',
    properties: {
      edges: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            source: { type: 'string', description: 'Source node ID' },
            target: { type: 'string', description: 'Target node ID' },
            sourceHandle: {
              type: 'string',
              description:
                'Source handle ID (e.g. "message-out", "audio-out", "video-out", "out-0")'
            },
            targetHandle: {
              type: 'string',
              description: 'Target handle ID (e.g. "message-in", "audio-in", "video-in", "in-0")'
            }
          },
          required: ['source', 'target']
        },
        description: 'Edges to create between existing nodes'
      }
    },
    required: ['edges']
  }
};
