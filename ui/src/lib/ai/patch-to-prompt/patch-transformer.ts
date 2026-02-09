/**
 * Transforms a patch (nodes + edges) into a cleaned format suitable for LLM prompts.
 * Strips visual-only fields while preserving semantic structure.
 */

import type { Node, Edge } from '@xyflow/svelte';

export interface CleanedNode {
  id: string;
  type: string;
  data: unknown;
}

export interface CleanedEdge {
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
}

export interface CleanedPatch {
  nodes: CleanedNode[];
  edges: CleanedEdge[];
  metadata: {
    nodeCount: number;
    edgeCount: number;
    nodeTypes: string[];
  };
}

/**
 * Fields to strip from node objects (visual/UI-only data)
 */
const NODE_FIELDS_TO_STRIP = new Set([
  'position',
  'positionAbsolute',
  'selected',
  'dragging',
  'draggable',
  'selectable',
  'connectable',
  'deletable',
  'measured',
  'width',
  'height',
  'zIndex',
  'parentId',
  'expandParent',
  'sourcePosition',
  'targetPosition',
  'hidden',
  'resizing',
  'focusable',
  'style',
  'className',
  'ariaLabel'
]);

/**
 * Fields to strip from node.data (internal state, not semantic)
 */
const DATA_FIELDS_TO_STRIP = new Set([
  // Internal state
  '_lastRender',
  '_frameCount',
  '_initialized',
  // UI state
  'isSelected',
  'isFocused',
  'isHovered'
]);

/**
 * Cleans a single node, removing visual-only fields
 */
function cleanNode(node: Node): CleanedNode {
  const cleaned: CleanedNode = {
    id: node.id,
    type: node.type ?? 'unknown',
    data: cleanNodeData(node.data)
  };

  return cleaned;
}

/**
 * Cleans node data, removing internal state fields
 */
function cleanNodeData(data: unknown): unknown {
  if (!data || typeof data !== 'object') {
    return data;
  }

  const cleaned: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
    if (DATA_FIELDS_TO_STRIP.has(key)) {
      continue;
    }

    // Recursively clean nested objects, but keep arrays as-is
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      cleaned[key] = cleanNodeData(value);
    } else {
      cleaned[key] = value;
    }
  }

  return cleaned;
}

/**
 * Cleans a single edge, keeping only semantic fields
 */
function cleanEdge(edge: Edge): CleanedEdge {
  const cleaned: CleanedEdge = {
    source: edge.source,
    target: edge.target
  };

  if (edge.sourceHandle) {
    cleaned.sourceHandle = edge.sourceHandle;
  }

  if (edge.targetHandle) {
    cleaned.targetHandle = edge.targetHandle;
  }

  return cleaned;
}

/**
 * Transforms a full patch into a cleaned format suitable for LLM prompts.
 * Removes visual/UI fields while preserving semantic structure.
 */
export function cleanPatch(nodes: Node[], edges: Edge[]): CleanedPatch {
  const cleanedNodes = nodes.map(cleanNode);
  const cleanedEdges = edges.map(cleanEdge);

  // Extract unique node types
  const nodeTypes = [...new Set(cleanedNodes.map((n) => n.type))];

  return {
    nodes: cleanedNodes,
    edges: cleanedEdges,
    metadata: {
      nodeCount: cleanedNodes.length,
      edgeCount: cleanedEdges.length,
      nodeTypes
    }
  };
}

/**
 * Converts cleaned patch to JSON string with formatting
 */
export function patchToJson(patch: CleanedPatch): string {
  return JSON.stringify(
    {
      nodes: patch.nodes,
      edges: patch.edges
    },
    null,
    2
  );
}
