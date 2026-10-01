import type { Node } from '@xyflow/svelte';
import {
  AddEdgesCommand,
  BatchCommand,
  DeleteEdgesCommand,
  DeleteNodesCommand,
  type CanvasStateAccessors,
  type Command,
  type HistoryManager
} from '$lib/history';
import { getObjectCodeFiles } from '$lib/objects/object-code-files';
import { isValidConnectionBetweenHandles } from '$lib/utils/connection-validation';
import {
  connectionDelta,
  parseConnections,
  serializeConnections,
  wireKey,
  type Wire
} from './connections';
import type { MountEntry } from '$lib/vfs/VfsMountTree';

export interface GraphPort {
  id: string | null;
  kind: 'audio' | 'video' | 'message' | 'analysis';
  isAudioParam?: boolean;
  acceptsFloat?: boolean;
}

export interface GraphPorts {
  ready: boolean;
  inlets: GraphPort[];
  outlets: GraphPort[];
}

export type GraphCommand =
  | { kind: 'graph.query'; nodeId?: string }
  | {
      kind: 'node.create';
      name: string;
      position?: { x: number; y: number };
      data?: Record<string, unknown>;
    }
  | { kind: 'node.delete'; nodeIds: string[] }
  | { kind: 'wire.change'; add: Wire[]; remove: Wire[] };

interface GraphServiceOptions {
  accessors: CanvasStateAccessors;
  history: HistoryManager;
  ports: (node: Node) => GraphPorts;
  create: (command: Extract<GraphCommand, { kind: 'node.create' }>) => string;
  settle: () => Promise<void>;
}

export class RemoteControlGraphService {
  constructor(private readonly options: GraphServiceOptions) {}

  async settle(): Promise<void> {
    await this.options.settle();
  }

  snapshot() {
    const { accessors, ports } = this.options;

    return {
      nodes: accessors
        .getNodes()
        .map((node) => ({
          id: node.id,
          type: node.type,
          name: node.data.name,
          expression: node.data.expr,
          position: node.position,
          sourcePaths: getObjectCodeFiles(node).map(
            (file) => `objects/${node.id}/${file.filename}`
          ),
          ports: ports(node)
        }))
        .sort((a, b) => a.id.localeCompare(b.id)),
      edges: accessors
        .getEdges()
        .map((edge) => ({
          id: edge.id,
          source: edge.source,
          sourceHandle: edge.sourceHandle ?? null,
          target: edge.target,
          targetHandle: edge.targetHandle ?? null
        }))
        .sort((a, b) => a.id.localeCompare(b.id))
    };
  }

  entries(): MountEntry[] {
    const graph = this.snapshot();

    return [
      { path: 'graph.json', kind: 'file', content: JSON.stringify(graph, null, 2) + '\n' },
      { path: 'connections.txt', kind: 'file', content: serializeConnections(graph.edges) }
    ];
  }

  async execute(command: GraphCommand): Promise<unknown> {
    if (!command || typeof command.kind !== 'string') throw new Error('Invalid graph command');

    const { accessors, history } = this.options;
    let nodeId: string | undefined;

    switch (command.kind) {
      case 'graph.query': {
        const graph = this.snapshot();
        if (!command.nodeId) return graph;

        const node = graph.nodes.find((node) => node.id === command.nodeId);
        if (!node) throw new Error(`Node ${command.nodeId} not found`);

        return node;
      }
      case 'node.create': {
        if (typeof command.name !== 'string' || !command.name.trim())
          throw new Error('Node name is required');
        if (
          command.position &&
          (!Number.isFinite(command.position.x) || !Number.isFinite(command.position.y))
        )
          throw new Error('Position must contain finite x and y');
        if (command.data && (typeof command.data !== 'object' || Array.isArray(command.data)))
          throw new Error('Node data must be an object');

        nodeId = this.options.create(command);
        break;
      }
      case 'node.delete': {
        if (!Array.isArray(command.nodeIds) || command.nodeIds.length === 0)
          throw new Error('nodeIds is required');

        const nodes = [...new Set(command.nodeIds)].map((id) => {
          const node = accessors.getNodes().find((node) => node.id === id);
          if (!node) throw new Error(`Node ${id} not found`);

          return node;
        });

        history.execute(new DeleteNodesCommand(nodes, accessors));
        break;
      }
      case 'wire.change':
        this.changeWires(command.add, command.remove);
        break;
      default:
        throw new Error('Unknown graph command');
    }

    await this.options.settle();

    return nodeId ? this.snapshot().nodes.find((node) => node.id === nodeId) : this.snapshot();
  }

  async writeConnections(content: string, baseline: string): Promise<void> {
    const delta = connectionDelta(baseline, content);
    const lines = new Map<string, number>();
    for (const [index, line] of content.split(/\r?\n/).entries()) {
      for (const wire of parseConnections(line)) lines.set(wireKey(wire), index + 1);
    }
    this.changeWires(delta.add, delta.remove, lines);

    await this.options.settle();
  }

  private changeWires(add: Wire[], remove: Wire[], lines?: Map<string, number>): void {
    if (!Array.isArray(add) || !Array.isArray(remove))
      throw new Error('Wire changes require add and remove arrays');

    const { accessors, history } = this.options;
    const existing = accessors.getEdges();
    const removeKeys = new Set(
      remove.map((wire) => {
        this.assertWire(wire);
        return wireKey(wire);
      })
    );
    const removed = existing.filter((edge) =>
      removeKeys.has(
        wireKey({
          ...edge,
          sourceHandle: edge.sourceHandle ?? null,
          targetHandle: edge.targetHandle ?? null
        })
      )
    );
    const remaining = new Set(
      existing
        .filter((edge) => !removed.includes(edge))
        .map((edge) =>
          wireKey({
            ...edge,
            sourceHandle: edge.sourceHandle ?? null,
            targetHandle: edge.targetHandle ?? null
          })
        )
    );
    const added = [];

    for (const wire of add) {
      this.assertWire(wire);

      const key = wireKey(wire);
      if (remaining.has(key)) continue;

      try {
        const source = this.port(wire.source, wire.sourceHandle, 'outlets');
        const target = this.port(wire.target, wire.targetHandle, 'inlets');
        const sourceId = `${source.kind}-out`;
        const targetId = `${target.kind}-in`;
        if (
          !isValidConnectionBetweenHandles(sourceId, targetId, {
            isTargetAudioParam: target.isAudioParam,
            isTargetAcceptsFloat: target.acceptsFloat
          })
        )
          throw new Error(
            `Incompatible ports: ${wire.source}:${wire.sourceHandle} -> ${wire.target}:${wire.targetHandle}`
          );
      } catch (error) {
        const line = lines?.get(key);
        throw new Error(
          `${line ? `Line ${line}: ` : ''}${error instanceof Error ? error.message : 'Invalid wire'}`
        );
      }

      added.push({ id: `remote-edge-${crypto.randomUUID()}`, ...wire, type: 'default' });
      remaining.add(key);
    }

    const commands: Command[] = [];
    if (removed.length) commands.push(new DeleteEdgesCommand(removed, accessors));
    if (added.length) commands.push(new AddEdgesCommand(added, accessors));
    if (commands.length) history.execute(new BatchCommand(commands, 'Change remote connections'));
  }

  private assertWire(wire: Wire): void {
    if (
      !wire ||
      typeof wire.source !== 'string' ||
      !wire.source ||
      typeof wire.target !== 'string' ||
      !wire.target ||
      !(wire.sourceHandle === null || typeof wire.sourceHandle === 'string') ||
      !(wire.targetHandle === null || typeof wire.targetHandle === 'string')
    )
      throw new Error('A wire requires source, sourceHandle, target, targetHandle');
  }

  private port(nodeId: string, handle: string | null, direction: 'inlets' | 'outlets'): GraphPort {
    const node = this.options.accessors.getNodes().find((node) => node.id === nodeId);
    if (!node) throw new Error(`Node ${nodeId} not found`);

    const ports = this.options.ports(node);
    if (!ports.ready) throw new Error(`ports_not_ready: ${nodeId}`);

    const port =
      handle === null && ports[direction].length === 1
        ? ports[direction][0]
        : ports[direction].find((port) => port.id === handle);
    if (!port)
      throw new Error(`Handle ${nodeId}:${handle ?? '@default'} not found in ${direction}`);

    return port;
  }
}
