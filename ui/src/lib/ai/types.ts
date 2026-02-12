/**
 * Shared types for AI object operations.
 */

/**
 * A node to be created by AI, with optional relative positioning.
 */
export interface AiObjectNode {
  type: string;
  data: Record<string, unknown>;
  position?: { x: number; y: number };
}

/**
 * A simplified edge representation using node indices.
 * Used for AI-generated connections before nodes have IDs.
 */
export interface SimplifiedEdge {
  source: number; // Index of source node in nodes array
  target: number; // Index of target node in nodes array
  sourceHandle?: string; // e.g., 'message-out', 'audio-out', 'in-0', 'video-in-0'
  targetHandle?: string; // e.g., 'message-in', 'audio-in', 'in-1', 'audio-in-0'
}

/**
 * Result from multi-object AI resolution.
 */
export interface MultiObjectResult {
  nodes: AiObjectNode[];
  edges: SimplifiedEdge[];
}
