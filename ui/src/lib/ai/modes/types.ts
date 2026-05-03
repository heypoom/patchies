import type { Component } from 'svelte';
import type { Edge, Node } from '@xyflow/svelte';
import type { AiObjectNode, SimplifiedEdge } from '$lib/ai/types';

export type AiPromptColor = 'purple' | 'blue' | 'amber' | 'green' | 'red';

export type AiPromptMode =
  | 'insert' // Create one object
  | 'multi' // Create multiple connected objects
  | 'edit' // Edit existing object data
  | 'turn-into' // Replace object type + data
  | 'fix-error' // Fix code error using console output
  | 'make-consumer' // Create a consumer for the selected producer node
  | 'make-producer' // Create a producer for the selected consumer node
  | 'split' // Split object into multiple
  | 'fork' // Create a new object derived from an existing one
  | 'connect-edges' // Connect existing nodes with edges
  | 'disconnect-edges' // Remove edges between nodes
  | 'delete-objects'; // Delete existing nodes

export interface AiModeContext {
  /** The node being edited/replaced/decomposed */
  selectedNode?: Node;

  /** Error messages for fix-error mode */
  consoleErrors?: string[];
}

export interface AiModeDescriptor {
  id: AiPromptMode;
  label: string;

  /** Short label for mode selector buttons */
  shortLabel: string;

  description: (ctx: AiModeContext) => string;
  placeholder: (ctx: AiModeContext) => string;

  color: AiPromptColor;
  icon: Component;

  /** Whether this mode creates multiple objects */
  isMulti: boolean;

  /** Whether this mode requires a selected node */
  requiresNode: boolean;

  /** Whether the prompt textarea is optional (e.g. fix-error, create-consumer) */
  promptOptional?: boolean;

  /** Present-tense verb shown in loading states, e.g. "Deciding", "Editing", "Fixing" */
  loadingLabel: string;

  /** Label shown when generating object config; receives resolved type e.g. "p5" */
  generatingLabel: (resolvedType: string) => string;
}

export type AiModeResult =
  | { kind: 'single'; type: string; data: Record<string, unknown> }
  | { kind: 'multi'; nodes: AiObjectNode[]; edges: SimplifiedEdge[] }
  | { kind: 'edit'; nodeId: string; data: Record<string, unknown> }
  | { kind: 'replace'; nodeId: string; newType: string; newData: Record<string, unknown> }
  | { kind: 'connect-edges'; edges: Edge[]; invalidEdges?: { reason: string }[] }
  | { kind: 'disconnect-edges'; edgeIds: string[] }
  | { kind: 'delete-objects'; nodeIds: string[] };

export type ModeResolver = (
  prompt: string,
  context: AiModeContext,
  signal: AbortSignal,
  onThinking: (thought: string) => void,
  onProgress?: (status: string) => void
) => Promise<AiModeResult>;
