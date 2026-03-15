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

When the user asks you to act on the canvas, always prefer the **simplest** tool that accomplishes the task. Before creating anything, call **get_graph_nodes** to check what already exists on the canvas.

1. **edit** — If a node already exists and the user wants changes, ALWAYS use edit. Never recreate an object that already exists.
2. **connect_edges** — If the nodes the user wants connected already exist on the canvas, just connect them with edges. Do NOT recreate objects that are already there.
2b. **disconnect_edges** — If the user wants to remove a connection between nodes, use this. Call get_graph_nodes first to find edge IDs or source/target pairs.
3. **insert + connect_edges** — If the user needs a new object that should connect to existing objects, use **insert** to create ONLY the missing object, then use **connect_edges** to wire it to the existing node(s). Do NOT use multi when some objects already exist.
4. **insert** (single create) — If the user needs ONE new standalone object, use insert. Do NOT use multi just because a description is detailed.
5. **multi** (multi create) — ONLY use this when the user explicitly asks for multiple connected objects AND none of them exist on the canvas yet.

Common mistakes to avoid:
- Do NOT use multi to create a single object. Even complex objects (e.g. "a synthesizer with LFO modulation") should use insert if it's one node.
- Do NOT recreate objects that already exist on the canvas. Use edit or fix_error instead.
- Do NOT use multi when some objects already exist — use insert for the new object + connect_edges to wire it to existing ones.
- When the user says "make X" or "create X" (singular), default to insert unless they clearly need multiple nodes.

Keep answers concise and practical. Format code for the relevant node type.

## Available Object Types

${OBJECT_TYPE_LIST}`;

// ── Context tool names ────────────────────────────────────────────────────────

export const GET_OBJECT_INSTRUCTIONS = 'get_object_instructions';
export const GET_GRAPH_NODES = 'get_graph_nodes';
export const GET_NODE_DATA = 'get_node_data';
export const GET_NODE_ERRORS = 'get_node_errors';
export const SEARCH_DOCS = 'search_docs';
export const GET_DOC_CONTENT = 'get_doc_content';
export const CONNECT_EDGES = 'connect_edges';
export const DISCONNECT_EDGES = 'disconnect_edges';

export const CONTEXT_TOOL_NAMES = new Set([
  GET_OBJECT_INSTRUCTIONS,
  GET_GRAPH_NODES,
  GET_NODE_DATA,
  GET_NODE_ERRORS,
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
      'List all nodes AND edges currently on the canvas. Returns { nodes: [{id, type, name}], edges: [{id, source, target, sourceHandle, targetHandle}] }. Use this to discover what exists and what is already connected before creating or connecting anything.',
    parametersJsonSchema: { type: 'object', properties: {} }
  },
  {
    name: GET_NODE_DATA,
    description:
      'Fetch the full data of a specific node by its ID. Also returns connectedEdges showing all edges going in/out of this node, so you can see what it is already connected to.',
    parametersJsonSchema: {
      type: 'object',
      properties: {
        nodeId: { type: 'string', description: 'The node ID to fetch data for' }
      },
      required: ['nodeId']
    }
  },
  {
    name: GET_NODE_ERRORS,
    description:
      'Fetch recent error and warning logs for a specific node by its ID. Returns the last N log entries (default 10). Use this to diagnose issues with nodes that are not currently selected.',
    parametersJsonSchema: {
      type: 'object',
      properties: {
        nodeId: { type: 'string', description: 'The node ID to fetch errors for' },
        count: {
          type: 'number',
          description: 'Number of recent error/warning entries to return (default 10, max 50)'
        }
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
    'Connect existing nodes on the canvas by creating edges between them. Use get_graph_nodes first to discover node IDs, node types, and existing edge handles. Handle IDs vary per node type — check existing edges from get_graph_nodes for examples, or call get_object_instructions for API details.',
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
                'Source outlet handle ID — get exact IDs from get_object_instructions for the source node type'
            },
            targetHandle: {
              type: 'string',
              description:
                'Target inlet handle ID — get exact IDs from get_object_instructions for the target node type'
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

// ── Disconnect edges declaration ──────────────────────────────────────────────

export const disconnectEdgesDeclaration = {
  name: DISCONNECT_EDGES,
  description:
    'Remove existing edges (connections) between nodes on the canvas. Use get_graph_nodes first to discover edge IDs. You can disconnect by edge ID, or by specifying source/target node pairs.',
  parametersJsonSchema: {
    type: 'object',
    properties: {
      edges: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            edgeId: {
              type: 'string',
              description: 'The edge ID to remove (from get_graph_nodes)'
            },
            source: {
              type: 'string',
              description:
                'Source node ID — used with target to find edges when edgeId is not known'
            },
            target: {
              type: 'string',
              description:
                'Target node ID — used with source to find edges when edgeId is not known'
            },
            sourceHandle: {
              type: 'string',
              description: 'Optional: narrow by source handle when using source/target pair'
            },
            targetHandle: {
              type: 'string',
              description: 'Optional: narrow by target handle when using source/target pair'
            }
          }
        },
        description:
          'Edges to remove. Provide edgeId for exact removal, or source+target to match by endpoints.'
      }
    },
    required: ['edges']
  }
};
