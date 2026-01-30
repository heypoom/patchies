import type { Node, Edge } from '@xyflow/svelte';
import { tick } from 'svelte';
import { getDefaultNodeData } from '$lib/nodes/defaultNodeData';
import { shaderCodeToUniformDefs } from '$lib/canvas/shader-code-to-uniform-def';

const DEFAULT_NODE_SPACING = 320; // Horizontal spacing between nodes

export type SimplifiedEdgeInput = {
  source: number;
  target: number;
  sourceHandle?: string;
  targetHandle?: string;
};

export type MultiObjectInsertInput = {
  objectNodes: Array<{ type: string; data: any; position?: { x: number; y: number } }>;
  simplifiedEdges: SimplifiedEdgeInput[];
  basePosition: { x: number; y: number };
  nodeIdCounter: number;
  edgeIdCounter: number;
  viewport?: { x: number; y: number; zoom: number };
};

export type MultiObjectInsertResult = {
  newNodes: Node[];
  newEdges: Edge[];
  nextNodeIdCounter: number;
  nextEdgeIdCounter: number;
};

/**
 * Handles the insertion of multiple AI-generated objects with automatic edge connection.
 * - Pre-parses code with setPortCount() calls (p5, js, canvas, canvas.dom, tone~, dsp~, elem~, sonic~, hydra)
 * - Pre-parses GLSL code to extract uniform definitions
 * - Auto-fills missing targetHandle for GLSL connections
 * - basePosition is already in flow coordinates (accounts for current zoom/pan via screenToFlowPosition)
 * - viewport parameter is available for future optimization but basePosition handles positioning
 */
export async function handleMultiObjectInsert(
  input: MultiObjectInsertInput
): Promise<MultiObjectInsertResult> {
  const { objectNodes, simplifiedEdges, basePosition, nodeIdCounter, edgeIdCounter } = input;

  // Create nodes and track their IDs
  const createdNodeIds: string[] = [];
  const newNodes: Node[] = [];
  let currentNodeIdCounter = nodeIdCounter;

  objectNodes.forEach((objNode, index) => {
    const id = `${objNode.type}-${currentNodeIdCounter++}`;
    createdNodeIds.push(id);

    // Use relative positioning if provided, otherwise stack them
    const relativePos = objNode.position || { x: index * DEFAULT_NODE_SPACING, y: 0 };
    const position = {
      x: basePosition.x + relativePos.x,
      y: basePosition.y + relativePos.y
    };

    // Pre-parse code to extract setPortCount() calls for nodes that support it
    // This ensures message inlet/outlet handles exist when edges are created
    let nodeData = objNode.data ?? getDefaultNodeData(objNode.type);

    // Node types that use messageInletCount/messageOutletCount (audio nodes + hydra)
    const usesMessagePorts = ['tone~', 'dsp~', 'elem~', 'sonic~', 'hydra'];

    // Node types that use inletCount/outletCount (canvas/JS nodes)
    const usesRegularPorts = ['p5', 'js', 'canvas', 'canvas.dom'];

    const useDynamicMessagingPorts =
      usesMessagePorts.includes(objNode.type) || usesRegularPorts.includes(objNode.type);

    if (useDynamicMessagingPorts && nodeData.code) {
      const portCountMatch = nodeData.code.match(/setPortCount\((\d+)(?:,\s*(\d+))?\)/);

      if (portCountMatch) {
        const inletCount = parseInt(portCountMatch[1] || '0', 10);
        const outletCount = parseInt(portCountMatch[2] || '0', 10);

        if (usesMessagePorts.includes(objNode.type)) {
          nodeData = {
            ...nodeData,
            messageInletCount: inletCount,
            messageOutletCount: outletCount
          };
        } else {
          // usesRegularPorts
          nodeData = {
            ...nodeData,
            inletCount,
            outletCount
          };
        }
      }
    }

    // Pre-parse GLSL code to extract uniform definitions
    // This ensures GLSL inlet handles exist when edges are created
    if (objNode.type === 'glsl' && nodeData.code) {
      const uniformDefs = shaderCodeToUniformDefs(nodeData.code);
      nodeData = {
        ...nodeData,
        glUniformDefs: uniformDefs
      };
    }

    const newNode: Node = {
      id,
      type: objNode.type,
      position,
      data: nodeData
    };

    newNodes.push(newNode);
  });

  // Create edges using the created node IDs, with validation and auto-filling targetHandle
  let currentEdgeIdCounter = edgeIdCounter;
  const newEdges: Edge[] = simplifiedEdges
    .filter((edge) => {
      // Validate edge indices are within bounds
      const validSource = edge.source >= 0 && edge.source < createdNodeIds.length;
      const validTarget = edge.target >= 0 && edge.target < createdNodeIds.length;

      if (!validSource || !validTarget) {
        console.warn(
          `Invalid edge indices: source=${edge.source}, target=${edge.target}, max=${createdNodeIds.length - 1}`
        );
        return false;
      }

      return true;
    })
    .map((edge) => {
      const sourceId = createdNodeIds[edge.source];
      const targetId = createdNodeIds[edge.target];
      const targetNode = newNodes.find((n) => n.id === targetId);

      let targetHandle = edge.targetHandle;

      // Auto-fill missing targetHandle for GLSL nodes
      if (
        !targetHandle &&
        targetNode?.type === 'glsl' &&
        targetNode.data?.glUniformDefs &&
        Array.isArray(targetNode.data.glUniformDefs)
      ) {
        const uniformDefs = targetNode.data.glUniformDefs as Array<{
          name: string;
          type: string;
        }>;

        // Match by connection order: first edge -> first uniform, second -> second, etc.
        // Filter edges targeting the same node to find which uniform this should connect to
        const edgesToThisTarget = simplifiedEdges.filter((e) => e.target === edge.target);
        const indexInTarget = edgesToThisTarget.indexOf(edge);

        if (indexInTarget >= 0 && indexInTarget < uniformDefs.length) {
          const uniformDef = uniformDefs[indexInTarget];
          const handleType = uniformDef.type === 'sampler2D' ? 'video' : 'message';
          targetHandle = `${handleType}-in-${indexInTarget}-${uniformDef.name}-${uniformDef.type}`;
        }
      }

      return {
        id: `edge-${currentEdgeIdCounter++}`,
        source: sourceId,
        target: targetId,
        sourceHandle: edge.sourceHandle,
        targetHandle
      };
    });

  return {
    newNodes,
    newEdges,
    nextNodeIdCounter: currentNodeIdCounter,
    nextEdgeIdCounter: currentEdgeIdCounter
  };
}
