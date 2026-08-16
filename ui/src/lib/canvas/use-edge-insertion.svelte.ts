import { tick } from 'svelte';
import { SvelteSet } from 'svelte/reactivity';
import type { Edge, Node } from '@xyflow/svelte';

import { AddEdgesCommand, AddNodeCommand, BatchCommand, DeleteEdgesCommand } from '$lib/history';
import { getObjectNameFromExpr } from '$lib/objects/object-definitions';
import { objectSchemas } from '$lib/objects/schemas';

import {
  createEdgeInsertionPreview,
  getCenteredNodeInsertionPosition,
  getEdgeInsertionPosition,
  planEdgeInsertion
} from '$lib/canvas/edge-insertion';

import {
  applyEdgeInsertionPipePreset,
  getEdgeInsertionObjectName,
  prepareNodeForEdgeInsertion
} from '$lib/canvas/edge-insertion-adapters';

import { CanvasContext } from '$lib/services/CanvasContext';
import { NodeOperationsService } from '$lib/services/NodeOperationsService';

const INSERTED_NODE_Z_INDEX = 1001;

interface PendingEdgeInsertion {
  edge: Edge;
  previewEdgeIds: string[];
}

/** Owns the temporary splice and final rewiring used when inserting into a selected edge. */
export function useEdgeInsertion(canvasContext: CanvasContext, nodeOps: NodeOperationsService) {
  let pendingEdgeInsertion = $state.raw<PendingEdgeInsertion | null>(null);
  const confirmedQuickInsertNodeIds = new SvelteSet<string>();

  function getSingleSelectedEdge(selectedEdgeIds: string[]): Edge | undefined {
    if (selectedEdgeIds.length !== 1) return undefined;

    return canvasContext.edges.find((edge) => edge.id === selectedEdgeIds[0]);
  }

  function beginObjectBrowser(selectedEdgeIds: string[]) {
    const edge = getSingleSelectedEdge(selectedEdgeIds);

    pendingEdgeInsertion = edge ? { edge, previewEdgeIds: [] } : null;
  }

  function clearPendingInsertion() {
    pendingEdgeInsertion = null;
  }

  function quickAdd(selectedEdgeIds: string[], fallbackPosition: { x: number; y: number }) {
    const edge = getSingleSelectedEdge(selectedEdgeIds);
    const position = edge ? getEdgeInsertionPosition(edge, canvasContext.nodes) : null;

    createQuickInsertNode(position ?? fallbackPosition, edge);
  }

  async function selectObject(name: string, fallbackPosition: { x: number; y: number }) {
    const edge = pendingEdgeInsertion?.edge;

    const position =
      (edge && getEdgeInsertionPosition(edge, canvasContext.nodes)) ?? fallbackPosition;

    const nodeId = nodeOps.createNodeFromName(
      edge ? getEdgeInsertionObjectName(name) : name,
      position,
      { skipHistory: true }
    );

    await recordInsertedNode(nodeId);
  }

  async function confirmQuickAdd(finalNodeId: string, objectName: string) {
    if (confirmedQuickInsertNodeIds.has(finalNodeId)) return;

    confirmedQuickInsertNodeIds.add(finalNodeId);

    await recordInsertedNode(finalNodeId, objectName);
  }

  function cancelQuickAdd(nodeId: string) {
    canvasContext.nodes = canvasContext.nodes.filter((node) => node.id !== nodeId);

    const pending = pendingEdgeInsertion;
    pendingEdgeInsertion = null;

    if (!pending) return;

    canvasContext.edges = [
      ...canvasContext.edges.filter((edge) => !pending.previewEdgeIds.includes(edge.id)),
      ...(canvasContext.edges.some((edge) => edge.id === pending.edge.id) ? [] : [pending.edge])
    ];
  }

  function createQuickInsertNode(position: { x: number; y: number }, edge?: Edge) {
    const nodeId = nodeOps.createNode('object', position, undefined, { skipHistory: true });
    if (!edge) return;

    const previewEdges = createEdgeInsertionPreview(edge, nodeId, [
      canvasContext.nextEdgeId(),
      canvasContext.nextEdgeId()
    ]);

    pendingEdgeInsertion = { edge, previewEdgeIds: previewEdges.map((preview) => preview.id) };

    canvasContext.nodes = canvasContext.nodes.map((node) =>
      node.id === nodeId ? { ...node, zIndex: INSERTED_NODE_Z_INDEX } : node
    );

    canvasContext.edges = [
      ...canvasContext.edges.filter((candidate) => candidate.id !== edge.id),
      ...previewEdges
    ];

    centerQuickInsertPreview(nodeId, edge);
  }

  async function centerQuickInsertPreview(nodeId: string, edge: Edge) {
    await tick();
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

    const node = canvasContext.nodes.find((candidate) => candidate.id === nodeId);
    if (!node || pendingEdgeInsertion?.edge.id !== edge.id) return;

    const position = getCenteredNodeInsertionPosition(edge, canvasContext.nodes, node);
    if (!position) return;

    canvasContext.nodes = canvasContext.nodes.map((candidate) =>
      candidate.id === nodeId ? { ...candidate, position } : candidate
    );
  }

  async function recordInsertedNode(nodeId: string, quickInsertObjectName?: string) {
    await tick();
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

    let node = canvasContext.nodes.find((candidate) => candidate.id === nodeId);
    if (!node) return;

    const pending = pendingEdgeInsertion;
    const edge = pending?.edge;
    pendingEdgeInsertion = null;

    if (!edge) {
      const command = new AddNodeCommand({ ...node }, canvasContext.canvasAccessors);
      canvasContext.historyManager.record(command);

      return;
    }

    if (quickInsertObjectName) {
      node = applyEdgeInsertionPipePreset(node, quickInsertObjectName);
    }

    node = prepareNodeForEdgeInsertion(node, edge);

    const centeredPosition = getCenteredNodeInsertionPosition(edge, canvasContext.nodes, node);

    if (centeredPosition) {
      node = { ...node, position: centeredPosition };
    }

    node = { ...node, zIndex: INSERTED_NODE_Z_INDEX };

    canvasContext.nodes = canvasContext.nodes.map((candidate) =>
      candidate.id === nodeId ? node : candidate
    );

    const plan = planEdgeInsertion(
      edge,
      node,
      canvasContext.nodes.find((candidate) => candidate.id === edge.target),
      objectSchemas,
      getNodeObjectName
    );

    if (!plan) {
      if (!canvasContext.edges.some((candidate) => candidate.id === edge.id)) {
        canvasContext.edges = [
          ...canvasContext.edges.filter(
            (candidate) => !pending.previewEdgeIds.includes(candidate.id)
          ),
          edge
        ];
      } else if (pending.previewEdgeIds.length > 0) {
        canvasContext.edges = canvasContext.edges.filter(
          (candidate) => !pending.previewEdgeIds.includes(candidate.id)
        );
      }

      const command = new AddNodeCommand({ ...node }, canvasContext.canvasAccessors);
      canvasContext.historyManager.record(command);

      return;
    }

    const insertedEdges: Edge[] = [
      {
        id: canvasContext.nextEdgeId(),
        source: edge.source,
        sourceHandle: plan.sourceHandle,
        target: node.id,
        targetHandle: plan.insertedInletHandle,
        zIndex: 0
      },
      {
        id: canvasContext.nextEdgeId(),
        source: node.id,
        sourceHandle: plan.insertedOutletHandle,
        target: edge.target,
        targetHandle: plan.targetHandle,
        zIndex: 0
      }
    ];

    canvasContext.edges = [
      ...canvasContext.edges.filter(
        (candidate) => candidate.id !== edge.id && !pending.previewEdgeIds.includes(candidate.id)
      ),
      ...insertedEdges
    ];

    canvasContext.historyManager.record(
      new BatchCommand(
        [
          new AddNodeCommand({ ...node }, canvasContext.canvasAccessors),
          new DeleteEdgesCommand([edge], canvasContext.canvasAccessors),
          new AddEdgesCommand(insertedEdges, canvasContext.canvasAccessors)
        ],
        `Insert ${getNodeObjectName(node) ?? 'object'} into connection`
      )
    );
  }

  return {
    beginObjectBrowser,
    cancelQuickAdd,
    clearPendingInsertion,
    confirmQuickAdd,
    quickAdd,
    selectObject
  };
}

function getNodeObjectName(node: Node): string | undefined {
  if (node.type === 'object') {
    const data = node.data as { name?: string; expr?: string };

    return data.name ?? (data.expr ? getObjectNameFromExpr(data.expr) : undefined);
  }

  return node.type;
}
