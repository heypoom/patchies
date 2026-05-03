/**
 * Tool declarations and constants for the chat resolver.
 *
 * Extracted from resolver.ts to keep the streaming logic readable.
 */

import { OBJECT_TYPE_LIST } from '../object-descriptions-types';

// ── System prompt ─────────────────────────────────────────────────────────────

export const SYSTEM_PROMPT = `You are a helpful AI assistant embedded in Patchies, a visual node-based programming environment for audio-visual creative coding. Users connect objects to build real-time audio-visual patches.

Help with:
- Writing and debugging code for object types (e.g. P5.js, Hydra, GLSL shaders, JavaScript, audio DSP, etc.)
- Object connections, signal routing, and patch architecture
- Audio DSP concepts (oscillators, filters, envelopes, effects)
- Creative coding techniques and algorithms

You have canvas tools to create, edit, replace, or fix objects on the user's behalf.
However, NEVER use these tools unless the user has explicitly asked you to create, modify, or fix something.
If the user is just asking a question, exploring ideas, or having a conversation, respond with text only.
Do not proactively create objects or visualizations.
You can suggest simulation or visualization ideas in your text response, but wait until user has consented to it.

## Tool Categories

- **Context tools** read the patch, logs, docs, object instructions, samples, or packs. They do not queue canvas changes.
- **Direct canvas tools** queue concrete mutations from final structured arguments: insert_object, insert_objects, update_object_data, replace_object, connect_edges, disconnect_edges.
- **Subtask tools** call an LLM internally and return generated data to you. They do not queue canvas changes. Use generate_object_data and rewrite_object_data when you need generated object data before calling a direct canvas tool.
- **Legacy resolver tools** such as insert, multi, edit, turn_into, fix_error, split, and fork run an extra LLM-backed resolver and queue a canvas action directly. Use them only as fallback.

For non-trivial object creation or code/data rewriting, call **get_object_instructions** for the relevant object type before using a direct canvas tool. Use the returned instructions, schema, and handle reference to produce final object data or handle IDs.

## Tool Selection Priority

When the user asks you to act on the canvas, always prefer the **simplest direct tool** that accomplishes the task. Before creating anything, call **get_graph_nodes** to check what already exists on the canvas. If the user reports errors or unexpected behaviour, call **get_object_errors** with the relevant object IDs to read their error logs before attempting a fix.

1. **update_object_data** — If an object already exists and the user wants concrete data/property/code changes, use this. Never recreate an object that already exists.
2. **connect_edges** — If the objects the user wants connected already exist on the canvas, just connect them with edges. Do NOT recreate objects that are already there.
2b. **disconnect_edges** — If the user wants to remove a connection between objects, use this. Call get_graph_nodes first to find edge IDs or source/target pairs.
3. **insert_object + connect_edges** — If the user needs a new object that should connect to existing objects, use **insert_object** to create ONLY the missing object, then use **connect_edges** to wire it to the existing object(s). Do NOT use multi/insert_objects when some objects already exist.
4. **insert_object** — If the user needs ONE new standalone object and you can provide final data, use insert_object. Call get_object_instructions first for non-trivial object data.
5. **insert_objects** — ONLY use this when the user explicitly asks for multiple connected objects AND none of them exist on the canvas yet, and you can provide final node data and edges.
6. **Subtask + direct tool** — If a direct tool is not enough because you need generated object data or a rewrite, call generate_object_data or rewrite_object_data first, then call insert_object/update_object_data/replace_object with the returned data.
7. **Legacy resolver tools** — Use insert/multi/edit/fix_error/etc. only as fallback when the subtask + direct-tool path is not enough.

Common mistakes to avoid:
- Do NOT use multi/insert_objects to create a single object. Even complex objects (e.g. "a synthesizer with LFO modulation") should use insert_object if it's one object.
- Do NOT recreate objects that already exist on the canvas. Use update_object_data or fix_error instead.
- Do NOT use multi/insert_objects when some objects already exist — use insert_object for the new object + connect_edges to wire it to existing ones.
- When the user says "make X" or "create X" (singular), default to insert_object unless they clearly need multiple objects.
- Do NOT call generate_object_data or rewrite_object_data more than once for the same object/request unless the previous subtask failed, produced unusable data, or the user explicitly asked for alternatives.

## Batching Multiple Actions

When a task requires multiple operations (e.g., create an object AND connect it), call all required tools **in a single response** — do not wait between calls. For example, after get_graph_nodes, call insert_object and connect_edges together in the same turn.

After your actions are queued, always follow up with a short message describing what you did and letting the user know they can apply the changes.

Keep answers concise and practical. Format code for the relevant object type.

## Sample Search & Audio Files

When users ask for audio samples, drum sounds, or soundfiles:
1. **ALWAYS call search_samples first** to find real samples — NEVER guess sample names or URLs
2. After searching, generate final object data if needed, then call insert_object — sample URLs from the search are automatically attached to pads~ and soundfile~ objects
3. For strudel objects, include the strudel name (e.g. \`s("bd:0")\`) directly in the prompt
4. For sonic~ objects, include the sample or synthdef name in the prompt

## Available Object Types

${OBJECT_TYPE_LIST}`;

// ── Context tool names ────────────────────────────────────────────────────────

export const GET_OBJECT_INSTRUCTIONS = 'get_object_instructions';
export const GET_GRAPH_NODES = 'get_graph_nodes';
export const GET_OBJECT_DATA = 'get_object_data';
export const GET_OBJECT_LOGS = 'get_object_logs';
export const GET_OBJECT_ERRORS = 'get_object_errors';
export const SEARCH_DOCS = 'search_docs';
export const GET_DOC_CONTENT = 'get_doc_content';
export const LIST_PACKS = 'list_packs';
export const ENABLE_PACK = 'enable_pack';
export const SEARCH_SAMPLES = 'search_samples';
export const SEARCH_FREESOUND = 'search_freesound';
export const GENERATE_OBJECT_DATA = 'generate_object_data';
export const REWRITE_OBJECT_DATA = 'rewrite_object_data';
export const INSERT_OBJECT = 'insert_object';
export const INSERT_OBJECTS = 'insert_objects';
export const UPDATE_OBJECT_DATA = 'update_object_data';
export const REPLACE_OBJECT = 'replace_object';
export const CONNECT_EDGES = 'connect_edges';
export const DISCONNECT_EDGES = 'disconnect_edges';

export const CONTEXT_TOOL_NAMES = new Set([
  GET_OBJECT_INSTRUCTIONS,
  GET_GRAPH_NODES,
  GET_OBJECT_DATA,
  GET_OBJECT_LOGS,
  GET_OBJECT_ERRORS,
  SEARCH_DOCS,
  GET_DOC_CONTENT,
  LIST_PACKS,
  ENABLE_PACK,
  SEARCH_SAMPLES,
  SEARCH_FREESOUND
]);

export const SUBTASK_TOOL_NAMES = new Set([GENERATE_OBJECT_DATA, REWRITE_OBJECT_DATA]);

export const DIRECT_CANVAS_TOOL_NAMES = new Set([
  INSERT_OBJECT,
  INSERT_OBJECTS,
  UPDATE_OBJECT_DATA,
  REPLACE_OBJECT,
  CONNECT_EDGES,
  DISCONNECT_EDGES
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
    name: GET_OBJECT_DATA,
    description:
      'Fetch the full data of a specific object by its ID. Also returns connectedEdges showing all edges going in/out of this object, so you can see what it is already connected to.',
    parametersJsonSchema: {
      type: 'object',
      properties: {
        objectId: { type: 'string', description: 'The object ID to fetch data for' }
      },
      required: ['objectId']
    }
  },
  {
    name: GET_OBJECT_LOGS,
    description:
      'Fetch recent error and warning logs for a specific object by its ID. Returns the last N log entries (default 10). Use this to diagnose issues with objects that are not currently selected.',
    parametersJsonSchema: {
      type: 'object',
      properties: {
        objectId: { type: 'string', description: 'The object ID to fetch logs for' },
        count: {
          type: 'number',
          description: 'Number of recent error/warning entries to return (default 10, max 50)'
        }
      },
      required: ['objectId']
    }
  },
  {
    name: GET_OBJECT_ERRORS,
    description:
      'Fetch deduplicated error logs for multiple objects at once. Returns a map of objectId → string[] of error messages. Use this to survey errors across several objects without making one call per object.',
    parametersJsonSchema: {
      type: 'object',
      properties: {
        objectIds: {
          type: 'array',
          items: { type: 'string' },
          description: 'List of object IDs to fetch errors for'
        }
      },
      required: ['objectIds']
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
  },
  {
    name: LIST_PACKS,
    description:
      'List all available object packs and preset packs, including which ones are currently enabled. Use this to answer questions about what objects or presets are available, or before enabling/disabling packs.',
    parametersJsonSchema: { type: 'object', properties: {} }
  },
  {
    name: SEARCH_SAMPLES,
    description:
      'Search for audio samples and SuperCollider synthdefs across all built-in sample libraries (Strudel/Tidal, SuperSonic). Returns sample names, categories, URLs, and usage hints for strudel and sonic~ nodes. Use this to find real sample names instead of guessing. Results include: Strudel samples (use with s("category:index") in strudel code or as soundfile~ URL), SuperSonic samples/synthdefs (use with sonic~ node).',
    parametersJsonSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description:
            'Search query — matches sample names, categories, and groups (e.g. "kick", "piano", "bd", "ambi")'
        },
        kind: {
          type: 'string',
          enum: ['all', 'strudel', 'supersonic'],
          description:
            'Filter by sample kind: "strudel" for Strudel/Tidal samples only, "supersonic" for SuperSonic samples/synthdefs only (for sonic~ node), "all" for everything (default)'
        },
        maxResults: {
          type: 'number',
          description: 'Maximum number of results to return (default 20, max 50)'
        }
      },
      required: ['query']
    }
  },
  {
    name: SEARCH_FREESOUND,
    description:
      "Search Freesound.org for audio samples via live API. Requires the user to have configured a Freesound API key. Returns sample names, URLs, durations, and attribution info. Use this when built-in samples (search_samples) don't have what you need and the user wants to find specific real-world sounds.",
    parametersJsonSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search query for Freesound (e.g. "rain ambience", "glass breaking")'
        },
        maxResults: {
          type: 'number',
          description: 'Maximum number of results to return (default 10, max 30)'
        }
      },
      required: ['query']
    }
  },
  {
    name: ENABLE_PACK,
    description:
      'Enable or disable an object pack or preset pack. Call list_packs first to see pack IDs and current state. Locked packs (e.g. "starters") cannot be disabled.',
    parametersJsonSchema: {
      type: 'object',
      properties: {
        packId: {
          type: 'string',
          description: 'The pack ID to enable or disable (e.g. "vision", "midi", "p5-demos")'
        },
        kind: {
          type: 'string',
          enum: ['object', 'preset'],
          description: '"object" for object packs, "preset" for preset packs'
        },
        enable: {
          type: 'boolean',
          description: 'true to enable the pack, false to disable it'
        }
      },
      required: ['packId', 'kind', 'enable']
    }
  }
];

// ── Subtask tool declarations ────────────────────────────────────────────────

export const subtaskToolDeclarations = [
  {
    name: GENERATE_OBJECT_DATA,
    description:
      'LLM-backed subtask that generates final object data from a prompt. Returns { type, data }. This does NOT queue a canvas action; after receiving the result, call insert_object or replace_object with the returned data.',
    parametersJsonSchema: {
      type: 'object',
      properties: {
        type: {
          type: 'string',
          description:
            'Optional object type to generate. If provided, generation skips object routing. If omitted, the subtask chooses the best object type.'
        },
        prompt: {
          type: 'string',
          description: 'What object data/code/configuration to generate'
        }
      },
      required: ['prompt']
    }
  },
  {
    name: REWRITE_OBJECT_DATA,
    description:
      'LLM-backed subtask that rewrites existing object data for a known type. Returns { type, data }. This does NOT queue a canvas action; after receiving the result, call update_object_data or replace_object with the returned data.',
    parametersJsonSchema: {
      type: 'object',
      properties: {
        type: {
          type: 'string',
          description: 'Object type being rewritten, e.g. "p5", "glsl", "strudel"'
        },
        existingData: {
          type: 'object',
          description: 'Current object data to rewrite'
        },
        prompt: {
          type: 'string',
          description: 'Rewrite instructions'
        },
        errors: {
          type: 'array',
          items: { type: 'string' },
          description: 'Optional error messages to fix'
        }
      },
      required: ['type', 'existingData', 'prompt']
    }
  }
];

// ── Direct canvas action declarations ────────────────────────────────────────

export const insertObjectDeclaration = {
  name: INSERT_OBJECT,
  description:
    'Directly create one new object on the canvas from final structured object data. For non-trivial object data, call get_object_instructions for this type first, then use the returned instructions to fill data.',
  parametersJsonSchema: {
    type: 'object',
    properties: {
      type: {
        type: 'string',
        description: 'Object type to create, e.g. "p5", "slider", "glsl", "strudel"'
      },
      data: {
        type: 'object',
        description: 'Final object data/configuration for the new object'
      }
    },
    required: ['type', 'data']
  }
};

export const insertObjectsDeclaration = {
  name: INSERT_OBJECTS,
  description:
    'Directly create multiple new objects and optional edges from final structured data. Use this only when final object data is already known; otherwise use a subtask/generation tool first.',
  parametersJsonSchema: {
    type: 'object',
    properties: {
      nodes: {
        type: 'array',
        description: 'Objects to create',
        items: {
          type: 'object',
          properties: {
            type: { type: 'string', description: 'Object type to create' },
            data: { type: 'object', description: 'Final object data/configuration' },
            position: {
              type: 'object',
              description: 'Optional relative position for layout',
              properties: {
                x: { type: 'number' },
                y: { type: 'number' }
              }
            }
          },
          required: ['type', 'data']
        }
      },
      edges: {
        type: 'array',
        description: 'Optional edges between new objects by node index',
        items: {
          type: 'object',
          properties: {
            source: { type: 'number', description: 'Source node index in nodes array' },
            target: { type: 'number', description: 'Target node index in nodes array' },
            sourceHandle: { type: 'string', description: 'Optional source handle ID' },
            targetHandle: { type: 'string', description: 'Optional target handle ID' }
          },
          required: ['source', 'target']
        }
      }
    },
    required: ['nodes']
  }
};

export const updateObjectDataDeclaration = {
  name: UPDATE_OBJECT_DATA,
  description:
    'Directly update an existing object data/configuration by merging a patch into current data. Use get_object_data first unless the current data is already present in context. For non-trivial code rewrites, call get_object_instructions for the object type first.',
  parametersJsonSchema: {
    type: 'object',
    properties: {
      nodeId: { type: 'string', description: 'ID of the object to update' },
      patch: {
        type: 'object',
        description:
          'Data fields to merge into the object. Do not include internal fields like executeCode or __private fields.'
      }
    },
    required: ['nodeId', 'patch']
  }
};

export const replaceObjectDeclaration = {
  name: REPLACE_OBJECT,
  description:
    'Directly replace an existing object with a new type and final structured data. For non-trivial object data, call get_object_instructions for the new type first.',
  parametersJsonSchema: {
    type: 'object',
    properties: {
      nodeId: { type: 'string', description: 'ID of the object to replace' },
      type: { type: 'string', description: 'New object type' },
      data: { type: 'object', description: 'Final data/configuration for the replacement object' }
    },
    required: ['nodeId', 'type', 'data']
  }
};

// ── Connect edges declaration ─────────────────────────────────────────────────

export const connectEdgesDeclaration = {
  name: CONNECT_EDGES,
  description:
    'Connect existing objects on the canvas by creating edges between them. Use get_graph_nodes first to discover object IDs, object types, and existing edge handles. Handle IDs vary per object type — check existing edges from get_graph_nodes for examples, or call get_object_instructions for API details.',
  parametersJsonSchema: {
    type: 'object',
    properties: {
      edges: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            source: { type: 'string', description: 'Source object ID' },
            target: { type: 'string', description: 'Target object ID' },
            sourceHandle: {
              type: 'string',
              description:
                'Source outlet handle ID — get exact IDs from get_object_instructions for the source object type'
            },
            targetHandle: {
              type: 'string',
              description:
                'Target inlet handle ID — get exact IDs from get_object_instructions for the target object type'
            }
          },
          required: ['source', 'target']
        },
        description: 'Edges to create between existing objects'
      }
    },
    required: ['edges']
  }
};

// ── Disconnect edges declaration ──────────────────────────────────────────────

export const disconnectEdgesDeclaration = {
  name: DISCONNECT_EDGES,
  description:
    'Remove existing edges (connections) between objects on the canvas. Use get_graph_nodes first to discover edge IDs. You can disconnect by edge ID, or by specifying source/target object pairs.',
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
                'Source object ID — used with target to find edges when edgeId is not known'
            },
            target: {
              type: 'string',
              description:
                'Target object ID — used with source to find edges when edgeId is not known'
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
