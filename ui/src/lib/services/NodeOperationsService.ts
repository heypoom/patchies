import type { Node } from '@xyflow/svelte';
import { getDefaultNodeData } from '$lib/nodes/defaultNodeData';
import { nodeTypes } from '$lib/nodes/node-types';
import { PRESETS } from '$lib/presets/presets';
import { ObjectShorthandRegistry } from '$lib/registry/ObjectShorthandRegistry';
import { AudioRegistry } from '$lib/registry/AudioRegistry';
import { ObjectRegistry } from '$lib/registry/ObjectRegistry';
import { parseObjectParamFromString } from '$lib/objects/parse-object-param';
import {
  AddNodeCommand,
  DeleteNodesCommand,
  DeleteEdgesCommand,
  BatchCommand,
  type Command
} from '$lib/history';
import type { CanvasContext } from './CanvasContext';
import type { NodeReplaceEvent, VfsPathRenamedEvent } from '$lib/eventbus/events';

export interface CreateNodeOptions {
  skipHistory?: boolean;
}

/**
 * NodeOperationsService handles node creation, deletion, and manipulation.
 * Instantiated per-component to support future headless/multi-canvas scenarios.
 */
export class NodeOperationsService {
  constructor(private ctx: CanvasContext) {}

  /**
   * Create a new node at the specified position.
   * @param type Node type
   * @param position Position in flow coordinates
   * @param customData Optional custom data for the node
   * @param options Options like skipHistory for Quick Add
   * @returns The new node ID
   */
  createNode(
    type: string,
    position: { x: number; y: number },
    customData?: Record<string, unknown>,
    options?: CreateNodeOptions
  ): string {
    const id = this.ctx.nextNodeId(type);

    const newNode: Node = {
      id,
      type,
      position,
      data: customData ?? getDefaultNodeData(type)
    };

    if (options?.skipHistory) {
      this.ctx.nodes = [...this.ctx.nodes, newNode];
    } else {
      this.ctx.historyManager.execute(new AddNodeCommand(newNode, this.ctx.canvasAccessors));
    }

    return id;
  }

  /**
   * Create a node from an object name (handles both visual nodes and textual objects).
   * Textual objects (like out~, expr, adsr) are created as 'object' nodes.
   * Visual nodes (like p5, hydra, glsl) are created with their actual type.
   */
  createNodeFromName(name: string, position: { x: number; y: number }): string {
    // Check if it's a visual node type
    if (nodeTypes[name as keyof typeof nodeTypes]) {
      return this.createNode(name, position);
    }

    // Check if it's a preset
    const preset = PRESETS[name];
    if (preset) {
      return this.createNode(preset.type, position, preset.data as Record<string, unknown>);
    }

    // Check if it's a textual object (audio or text object)
    const audioRegistry = AudioRegistry.getInstance();
    const objectRegistry = ObjectRegistry.getInstance();

    if (audioRegistry.isDefined(name) || objectRegistry.isDefined(name)) {
      // Create an 'object' node with the textual object name and default params
      const defaultParams = parseObjectParamFromString(name, []);
      return this.createNode('object', position, {
        expr: name,
        name: name,
        params: defaultParams
      });
    }

    // Fallback: try shorthand transformation
    const shorthandResult = ObjectShorthandRegistry.getInstance().tryTransform(name);
    if (shorthandResult) {
      return this.createNode(shorthandResult.nodeType, position, shorthandResult.data);
    }

    // Last resort: create as-is
    return this.createNode(name, position);
  }

  /**
   * Replace a node with a new type while preserving position and updating edges.
   * Used for converting between compatible node types (e.g., soundfile~ to sampler~).
   */
  replaceNode(event: NodeReplaceEvent): void {
    const { nodeId, newType, newData, handleMapping } = event;

    // Find the old node
    const oldNode = this.ctx.nodes.find((n) => n.id === nodeId);
    if (!oldNode) return;

    // Create new node ID
    const newId = this.ctx.nextNodeId(newType);

    // Create the replacement node at the same position
    const newNode: Node = {
      id: newId,
      type: newType,
      position: oldNode.position,
      data: newData
    };

    // Update edges to point to the new node, mapping handle IDs if provided
    this.ctx.edges = this.ctx.edges.map((edge) => {
      if (edge.source === nodeId) {
        const newSourceHandle = handleMapping?.[edge.sourceHandle ?? ''] ?? edge.sourceHandle;
        return { ...edge, source: newId, sourceHandle: newSourceHandle };
      }

      if (edge.target === nodeId) {
        const newTargetHandle = handleMapping?.[edge.targetHandle ?? ''] ?? edge.targetHandle;
        return { ...edge, target: newId, targetHandle: newTargetHandle };
      }

      return edge;
    });

    // Replace the old node with the new one
    this.ctx.nodes = this.ctx.nodes.map((n) => (n.id === nodeId ? newNode : n));
  }

  /**
   * Update vfsPath in all nodes when a VFS path is renamed.
   */
  handleVfsPathRenamed(event: VfsPathRenamedEvent): void {
    const { oldPath, newPath } = event;

    this.ctx.nodes = this.ctx.nodes.map((node) => {
      // Check if this node has a vfsPath that matches the old path
      if (node.data?.vfsPath === oldPath) {
        return { ...node, data: { ...node.data, vfsPath: newPath } };
      }
      return node;
    });
  }

  /**
   * Delete selected nodes and edges.
   * @param selectedNodeIds IDs of selected nodes
   * @param selectedEdgeIds IDs of selected edges
   */
  deleteSelectedElements(selectedNodeIds: string[], selectedEdgeIds: string[]): void {
    const nodes = this.ctx.nodes;
    const edges = this.ctx.edges;

    const nodesToDelete = nodes.filter((n) => selectedNodeIds.includes(n.id));
    const edgesToDelete = edges.filter((e) => selectedEdgeIds.includes(e.id));

    if (nodesToDelete.length === 0 && edgesToDelete.length === 0) return;

    // Build batch of delete commands
    const commands: Command[] = [];

    if (nodesToDelete.length > 0) {
      commands.push(new DeleteNodesCommand(nodesToDelete, this.ctx.canvasAccessors));
    }

    if (edgesToDelete.length > 0) {
      // Only delete edges not already handled by DeleteNodesCommand
      const nodeIds = new Set(nodesToDelete.map((n) => n.id));

      const standaloneEdges = edgesToDelete.filter(
        (e) => !nodeIds.has(e.source) && !nodeIds.has(e.target)
      );

      if (standaloneEdges.length > 0) {
        commands.push(new DeleteEdgesCommand(standaloneEdges, this.ctx.canvasAccessors));
      }
    }

    if (commands.length === 1) {
      this.ctx.historyManager.execute(commands[0]);
    } else if (commands.length > 1) {
      this.ctx.historyManager.execute(new BatchCommand(commands, 'Delete selection'));
    }
  }
}
