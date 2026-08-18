/**
 * Tool declarations and constants for the chat resolver.
 *
 * Extracted from resolver.ts to keep the streaming logic readable.
 */

// ── Context tool names ────────────────────────────────────────────────────────

export const GET_OBJECT_INSTRUCTIONS = 'get_object_instructions';
export const GET_GRAPH_NODES = 'get_graph_nodes';
export const GET_VIEWPORT = 'get_viewport';
export const GET_OBJECT_DATA = 'get_object_data';
export const GET_OBJECT_LOGS = 'get_object_logs';
export const GET_OBJECT_ERRORS = 'get_object_errors';
export const SEARCH_DOCS = 'search_docs';
export const GET_DOC_CONTENT = 'get_doc_content';
export const LIST_OBJECT_PACKS = 'list_object_packs';
export const LIST_PRESET_PACKS = 'list_preset_packs';
export const ENABLE_PACK = 'enable_pack';
export const SEARCH_PRESETS = 'search_presets';
export const GET_PRESET_CONTENT = 'get_preset_content';
export const SEARCH_SAMPLES = 'search_samples';
export const SEARCH_FREESOUND = 'search_freesound';
export const LIST_VFS_FILES = 'list_vfs_files';
export const SEARCH_VFS_FILES = 'search_vfs_files';
export const STAT_VFS_FILE = 'stat_vfs_file';
export const READ_VFS_TEXT = 'read_vfs_text';
export const GENERATE_OBJECT_DATA = 'generate_object_data';
export const REWRITE_OBJECT_DATA = 'rewrite_object_data';
export const GENERATE_OBJECT_GRAPH = 'generate_object_graph';
export const INSERT_OBJECT = 'insert_object';
export const INSERT_PRESET = 'insert_preset';
export const INSERT_OBJECTS = 'insert_objects';
export const UPDATE_OBJECT_DATA = 'update_object_data';
export const REPLACE_OBJECT = 'replace_object';
export const DELETE_OBJECTS = 'delete_objects';
export const MOVE_OBJECTS = 'move_objects';
export const CONNECT_EDGES = 'connect_edges';
export const DISCONNECT_EDGES = 'disconnect_edges';

export const CONTEXT_TOOL_NAMES = new Set([
  GET_OBJECT_INSTRUCTIONS,
  GET_GRAPH_NODES,
  GET_VIEWPORT,
  GET_OBJECT_DATA,
  GET_OBJECT_LOGS,
  GET_OBJECT_ERRORS,
  SEARCH_DOCS,
  GET_DOC_CONTENT,
  LIST_OBJECT_PACKS,
  LIST_PRESET_PACKS,
  ENABLE_PACK,
  SEARCH_PRESETS,
  GET_PRESET_CONTENT,
  SEARCH_SAMPLES,
  SEARCH_FREESOUND,
  LIST_VFS_FILES,
  SEARCH_VFS_FILES,
  STAT_VFS_FILE,
  READ_VFS_TEXT
]);

export const SUBTASK_TOOL_NAMES = new Set([
  GENERATE_OBJECT_DATA,
  REWRITE_OBJECT_DATA,
  GENERATE_OBJECT_GRAPH
]);

export const DIRECT_CANVAS_TOOL_NAMES = new Set([
  INSERT_OBJECT,
  INSERT_PRESET,
  INSERT_OBJECTS,
  UPDATE_OBJECT_DATA,
  REPLACE_OBJECT,
  DELETE_OBJECTS,
  MOVE_OBJECTS,
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
      'List all nodes AND edges currently on the canvas. Returns { nodes: [{id, type, name, position}], edges: [{id, source, target, sourceHandle, targetHandle}] }. Use this to discover what exists, positions for move_objects, and what is already connected before creating or connecting anything.',
    parametersJsonSchema: { type: 'object', properties: {} }
  },
  {
    name: GET_VIEWPORT,
    description:
      'Read the current canvas viewport and zoom. Returns viewport transform plus visible bounds and center in flow/canvas coordinates. Use this before placing new objects near the current view, visible area, or where the user is looking.',
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
    name: LIST_OBJECT_PACKS,
    description:
      'List all available object packs, including which ones are currently enabled. Use this to answer questions about what objects are available, or before enabling/disabling object packs.',
    parametersJsonSchema: { type: 'object', properties: {} }
  },
  {
    name: LIST_PRESET_PACKS,
    description:
      'List all available preset packs, including which ones are currently enabled. Use this to answer questions about preset groups, or before enabling/disabling preset packs.',
    parametersJsonSchema: { type: 'object', properties: {} }
  },
  {
    name: SEARCH_PRESETS,
    description:
      'Search available presets by preset name, preset pack name, folder path, library name, description, or object type. Call this before get_preset_content or insert_preset when the user gives an ambiguous preset name or asks for presets from a pack/category. For several candidate names, either call search_presets multiple times or pass a comma-separated query like "Noise, Mirror, Edge Detect"; bundled space-separated terms are also supported.',
    parametersJsonSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description:
            'Search query — matches preset names, preset pack names, folders, libraries, descriptions, and object types. Supports one phrase, comma-separated candidates, or bundled space-separated candidate terms.'
        },
        limit: {
          type: 'number',
          description: 'Maximum number of results to return (default 10, max 50)'
        }
      },
      required: ['query']
    }
  },
  {
    name: GET_PRESET_CONTENT,
    description:
      'Fetch the full content/data for an existing preset by exact preset name. Use this before forking, remixing, or making a new object based on a preset. Call search_presets first if the name is ambiguous.',
    parametersJsonSchema: {
      type: 'object',
      properties: {
        presetName: {
          type: 'string',
          description: 'Exact preset name to fetch, e.g. "Noise", "Blur", or "midi.slider"'
        }
      },
      required: ['presetName']
    }
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
    name: LIST_VFS_FILES,
    description:
      'List one bounded page of immediate files and folders in a virtual filesystem directory. Paths default to user:// and may use relative paths such as "./samples". Use nextOffset only when truncated is true to request the next page.',
    parametersJsonSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Directory to list (default "." for user://)' },
        offset: { type: 'number', description: 'Directory entry offset (default 0)' },
        limit: { type: 'number', description: 'Results per page (default 50, max 100)' }
      }
    }
  },
  {
    name: SEARCH_VFS_FILES,
    description:
      'Recursively search virtual filesystem paths below a directory. Returns one bounded page of matching files and folders, not file contents. Use nextOffset only when truncated is true to request the next page.',
    parametersJsonSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Case-insensitive path/name search query' },
        path: {
          type: 'string',
          description: 'Directory to search below (default "." for user://)'
        },
        offset: { type: 'number', description: 'Matching result offset (default 0)' },
        limit: { type: 'number', description: 'Results per page (default 50, max 100)' }
      },
      required: ['query']
    }
  },
  {
    name: STAT_VFS_FILE,
    description:
      'Get virtual filesystem file metadata: path, name, kind, provider, stored size in bytes when available, and MIME type when available. Call this before reading a file.',
    parametersJsonSchema: {
      type: 'object',
      properties: { path: { type: 'string', description: 'VFS file path' } },
      required: ['path']
    }
  },
  {
    name: READ_VFS_TEXT,
    description:
      'Read a bounded byte range from a textual virtual filesystem file. Call stat_vfs_file first. Refuses binary formats such as images, audio, and video. Defaults to 16 KiB; length is capped at 32 KiB. Use offset plus truncated to continue a large text file.',
    parametersJsonSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Text file path in the VFS' },
        offset: { type: 'number', description: 'Zero-based byte offset (default 0)' },
        length: { type: 'number', description: 'Maximum bytes to read (default 16384, max 32768)' }
      },
      required: ['path']
    }
  },
  {
    name: ENABLE_PACK,
    description:
      'Enable or disable an object pack or preset pack. Call list_object_packs or list_preset_packs first to see pack IDs and current state. Locked packs (e.g. "starters") cannot be disabled.',
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
    name: GENERATE_OBJECT_GRAPH,
    description:
      'LLM-backed subtask that generates multiple connected objects from a prompt. Returns { nodes, edges }. This does NOT queue a canvas action; after receiving the result, call insert_objects with the returned nodes and edges.',
    parametersJsonSchema: {
      type: 'object',
      properties: {
        prompt: {
          type: 'string',
          description: 'What connected object graph to generate'
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
      },
      position: {
        type: 'object',
        description: 'Optional absolute canvas position for the new object',
        properties: {
          x: { type: 'number' },
          y: { type: 'number' }
        },
        required: ['x', 'y']
      }
    },
    required: ['type', 'data']
  }
};

export const insertPresetDeclaration = {
  name: INSERT_PRESET,
  description:
    'Directly create one new object on the canvas from an existing preset by exact preset name. Call search_presets first when the user did not provide an exact preset name or when several presets might match.',
  parametersJsonSchema: {
    type: 'object',
    properties: {
      presetName: {
        type: 'string',
        description: 'Exact preset name to insert, e.g. "Noise", "Blur", or "midi.slider"'
      },
      position: {
        type: 'object',
        description: 'Optional absolute canvas position for the new object created from the preset',
        properties: {
          x: { type: 'number' },
          y: { type: 'number' }
        },
        required: ['x', 'y']
      }
    },
    required: ['presetName']
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

export const deleteObjectsDeclaration = {
  name: DELETE_OBJECTS,
  description:
    'Directly delete existing objects from the canvas. Use get_graph_nodes first to find exact object IDs. This queues a reviewed, undoable delete action.',
  parametersJsonSchema: {
    type: 'object',
    properties: {
      nodeIds: {
        type: 'array',
        items: { type: 'string' },
        description: 'IDs of objects to delete'
      }
    },
    required: ['nodeIds']
  }
};

export const moveObjectsDeclaration = {
  name: MOVE_OBJECTS,
  description:
    'Directly move existing objects to final absolute canvas positions. Use get_graph_nodes first to find exact object IDs and current positions. This queues a reviewed, undoable move action.',
  parametersJsonSchema: {
    type: 'object',
    properties: {
      positions: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            nodeId: { type: 'string', description: 'ID of the object to move' },
            position: {
              type: 'object',
              description: 'Final absolute position in canvas coordinates',
              properties: {
                x: { type: 'number' },
                y: { type: 'number' }
              },
              required: ['x', 'y']
            }
          },
          required: ['nodeId', 'position']
        },
        description: 'Objects to move with final absolute positions'
      }
    },
    required: ['positions']
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
