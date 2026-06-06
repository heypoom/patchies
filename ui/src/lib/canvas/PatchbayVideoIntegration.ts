import type { RenderNode } from '$lib/rendering/types';
import type { REdge } from '$lib/rendering/graphUtils';
import { VideoChannelRegistry } from './VideoChannelRegistry';

type PatchbayVideoIntegrationOptions = {
  upsertNode: (
    id: string,
    type: RenderNode['type'],
    data: Record<string, unknown>,
    options?: { force?: boolean }
  ) => boolean;
  removeNode: (nodeId: string) => void;
  onGraphChanged: () => void;
  videoChannelRegistry?: VideoChannelRegistry;
};

export class PatchbayVideoIntegration {
  private edges = new Map<string, REdge>();
  private routeNodeIds = new Map<string, { recvId: string; sendId: string }>();
  private videoChannelRegistry: VideoChannelRegistry;

  constructor(private options: PatchbayVideoIntegrationOptions) {
    this.videoChannelRegistry = options.videoChannelRegistry ?? VideoChannelRegistry.getInstance();
  }

  registerRoute(routeId: string, from: string, to: string): void {
    this.unregisterRoute(routeId);

    const recvId = `${routeId}:video-recv:${from}`;
    const sendId = `${routeId}:video-send:${to}`;

    this.routeNodeIds.set(routeId, { recvId, sendId });

    this.edges.set(routeId, {
      id: `${routeId}:video-edge:${from}->${to}`,
      source: recvId,
      target: sendId,
      sourceHandle: 'video-out',
      targetHandle: 'video-in-0'
    });

    this.options.upsertNode(recvId, 'recv.vdo', { channel: from }, { force: true });
    this.options.upsertNode(sendId, 'send.vdo', { channel: to }, { force: true });
    this.options.onGraphChanged();
  }

  registerEdge(edgeId: string, edge: REdge): void {
    this.edges.set(edgeId, edge);
    this.options.onGraphChanged();
  }

  unregisterRoute(routeId: string): void {
    const nodeIds = this.routeNodeIds.get(routeId);
    if (!nodeIds) return;

    this.edges.delete(routeId);
    this.routeNodeIds.delete(routeId);

    this.options.removeNode(nodeIds.recvId);
    this.options.removeNode(nodeIds.sendId);
    this.options.onGraphChanged();
  }

  unregisterEdge(edgeId: string): void {
    this.edges.delete(edgeId);
    this.options.onGraphChanged();
  }

  getEdges(): REdge[] {
    return [...this.edges.values()];
  }

  registerVideoChannelNode(
    nodeId: string,
    type: RenderNode['type'],
    data: Record<string, unknown>
  ): void {
    const channel = data.channel;
    if (typeof channel !== 'string' || channel.length === 0) return;

    if (type === 'send.vdo') {
      this.videoChannelRegistry.subscribe(channel, nodeId, 'send');
    }

    if (type === 'recv.vdo') {
      this.videoChannelRegistry.subscribe(channel, nodeId, 'recv');
    }
  }

  unregisterVideoChannelNode(nodeId: string): void {
    this.videoChannelRegistry.unsubscribeAll(nodeId);
  }
}
