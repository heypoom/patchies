import { Type } from '@sinclair/typebox';
import { match } from 'ts-pattern';

import { AudioChannelRegistry } from '$lib/audio/AudioChannelRegistry';
import { VideoChannelRegistry } from '$lib/canvas/VideoChannelRegistry';
import { MessageChannelRegistry } from '$lib/messages/MessageChannelRegistry';
import { getPatchbayAudioRuntime } from '$lib/patchbay/patchbay-audio-runtime';
import { getPatchbayMessageRuntime } from '$lib/patchbay/patchbay-message-runtime';
import { getPatchbayObjectPorts } from '$lib/patchbay/patchbay-object-ports';
import { getPatchbayVideoRuntime } from '$lib/patchbay/patchbay-video-runtime';
import {
  analyzePatchbay,
  type PatchbayDiagnostic,
  type PatchbayRoute
} from '$lib/patchbay/patchbay-parser';

import type { ObjectContext } from '../ObjectContext';
import type { ObjectInlet } from '../object-metadata';
import type { MessageMeta, TextObjectV2 } from '../interfaces/text-objects';
import type { Node } from '@xyflow/svelte';

type RouteMap = Map<string, string[]>;
type PatchbayObjectOptions = {
  getNodes?: () => Array<Pick<Node, 'id' | 'type' | 'data'>>;
};

export class PatchbayObject implements TextObjectV2 {
  static type = 'patchbay';
  static description = 'Route named message channels with a compact text patchbay';
  static tags = ['control', 'routing', 'channel', 'wireless'];

  static inlets: ObjectInlet[] = [
    {
      name: 'code',
      type: 'string',
      description: 'Patchbay DSL code',
      defaultValue: '',
      messages: [{ schema: Type.String(), description: 'Patchbay DSL code' }]
    }
  ];

  static outlets = [];

  readonly nodeId: string;
  readonly context: ObjectContext;
  private channelRegistry = MessageChannelRegistry.getInstance();
  private audioChannelRegistry = AudioChannelRegistry.getInstance();
  private videoChannelRegistry = VideoChannelRegistry.getInstance();
  private activeMessageSubscriptions = new Map<string, Set<string>>();
  private activeMessageEdges = new Set<string>();
  private activeMessageEndpoints = new Set<string>();
  private activeAudioRoutes = new Map<string, PatchbayRoute>();
  private activeAudioEdges = new Set<string>();
  private activeVideoRoutes = new Set<string>();
  private activeVideoEdges = new Set<string>();
  private currentDiagnostics: PatchbayDiagnostic[] = [];
  private unsubscribeRegistryChange: (() => void) | null = null;
  private unsubscribeAudioRegistryChange: (() => void) | null = null;
  private unsubscribeVideoRegistryChange: (() => void) | null = null;
  private unsubscribeParamsChange: (() => void) | null = null;
  private getNodes: () => Array<Pick<Node, 'id' | 'type' | 'data'>>;
  private lastAppliedSignature: string | null = null;

  constructor(nodeId: string, context: ObjectContext, options: PatchbayObjectOptions = {}) {
    this.nodeId = nodeId;
    this.context = context;
    this.getNodes = options.getNodes ?? (() => []);
  }

  create(rawParams: unknown[]): void {
    if (this.getCode().trim().length === 0 && rawParams.length > 0) {
      this.context.setParam('code', rawParams.join(' '));
    }

    this.applyCode();

    this.unsubscribeParamsChange = this.context.onParamsChange((_params, _index, _value) => {
      this.applyCode();
    });

    this.unsubscribeRegistryChange = this.channelRegistry.onChannelsChange(() => {
      this.applyCode();
    });
    this.unsubscribeAudioRegistryChange = this.audioChannelRegistry.onChannelsChange(() => {
      this.applyCode();
    });
    this.unsubscribeVideoRegistryChange = this.videoChannelRegistry.onChannelsChange(() => {
      this.applyCode();
    });
  }

  get diagnostics(): PatchbayDiagnostic[] {
    return [...this.currentDiagnostics];
  }

  applyCode(): void {
    const objectPorts = getPatchbayObjectPorts(this.getNodes());
    const signature = this.getApplySignature(objectPorts);
    if (signature === this.lastAppliedSignature) {
      return;
    }

    const analysis = analyzePatchbay(this.getCode(), {
      messageSources: new Set(this.channelRegistry.getSenderChannelNames()),
      messageTargets: new Set(this.channelRegistry.getReceiverChannelNames()),
      audioSources: new Set(this.audioChannelRegistry.getSenderChannelNames()),
      audioTargets: new Set(this.audioChannelRegistry.getReceiverChannelNames()),
      videoSources: new Set(this.videoChannelRegistry.getSenderChannelNames()),
      videoTargets: new Set(this.videoChannelRegistry.getReceiverChannelNames()),
      objects: objectPorts
    });
    this.currentDiagnostics = analysis.diagnostics;

    if (analysis.diagnostics.some((diagnostic) => diagnostic.severity === 'error')) {
      this.lastAppliedSignature = null;
      return;
    }

    this.applyMessageRoutes(analysis.messageRoutes);
    this.applyAudioRoutes(analysis.audioRoutes);
    this.applyVideoRoutes(analysis.videoRoutes);
    this.lastAppliedSignature = signature;
  }

  onMessage(data: unknown, meta: MessageMeta): void {
    match(meta.inletName)
      .with('code', () => {
        if (typeof data === 'string') {
          this.context.setParam('code', data, { notifyUI: true });
        }
      })
      .otherwise(() => {});
  }

  destroy(): void {
    this.unsubscribeParamsChange?.();
    this.unsubscribeParamsChange = null;
    this.unsubscribeRegistryChange?.();
    this.unsubscribeRegistryChange = null;
    this.unsubscribeAudioRegistryChange?.();
    this.unsubscribeAudioRegistryChange = null;
    this.unsubscribeVideoRegistryChange?.();
    this.unsubscribeVideoRegistryChange = null;
    this.clearSubscriptions();
    this.clearMessageEdges();
    this.clearMessageEndpoints();
    this.clearAudioRoutes();
    this.clearVideoRoutes();
  }

  private getCode(): string {
    const code = this.context.getParam('code');
    return typeof code === 'string' ? code : '';
  }

  private getApplySignature(objectPorts: ReturnType<typeof getPatchbayObjectPorts>): string {
    return JSON.stringify({
      code: this.getCode(),
      messageSources: this.channelRegistry.getSenderChannelNames().sort(),
      messageTargets: this.channelRegistry.getReceiverChannelNames().sort(),
      audioSources: this.audioChannelRegistry.getSenderChannelNames().sort(),
      audioTargets: this.audioChannelRegistry.getReceiverChannelNames().sort(),
      videoSources: this.videoChannelRegistry.getSenderChannelNames().sort(),
      videoTargets: this.videoChannelRegistry.getReceiverChannelNames().sort(),
      objects: Array.from(objectPorts.entries())
        .map(([nodeId, ports]) => [nodeId, ports])
        .sort(([a], [b]) => String(a).localeCompare(String(b)))
    });
  }

  private applyMessageRoutes(routes: PatchbayRoute[]): void {
    this.clearSubscriptions();
    this.clearMessageEdges();
    this.clearMessageEndpoints();

    const channelRoutes = routes.filter((route) => !route.fromEndpoint && !route.toEndpoint);
    const routesBySource = this.groupRoutesBySource(channelRoutes);

    for (const [source, destinations] of routesBySource) {
      const subscriberId = this.getSubscriberId(source);
      this.channelRegistry.subscribe(source, subscriberId, (message) => {
        for (const destination of destinations) {
          this.channelRegistry.broadcast(destination, message, this.nodeId);
        }
      });
      this.trackMessageSubscription(source, subscriberId);
    }

    for (const route of routes.filter((route) => route.fromEndpoint || route.toEndpoint)) {
      this.applyMessageObjectRoute(route);
    }
  }

  private applyAudioRoutes(routes: PatchbayRoute[]): void {
    this.clearAudioRoutes();

    for (const route of routes) {
      if (route.fromEndpoint || route.toEndpoint) {
        this.applyAudioObjectRoute(route);
        continue;
      }

      const endpointId = this.getAudioEndpointId(route);
      this.audioChannelRegistry.subscribe(route.from, endpointId, 'recv');
      this.audioChannelRegistry.subscribe(route.to, endpointId, 'send');
      this.activeAudioRoutes.set(endpointId, route);
    }
  }

  private applyVideoRoutes(routes: PatchbayRoute[]): void {
    this.clearVideoRoutes();

    for (const route of routes) {
      if (route.fromEndpoint || route.toEndpoint) {
        this.applyVideoObjectRoute(route);
        continue;
      }

      const routeId = this.getVideoRouteId(route);
      getPatchbayVideoRuntime().registerRoute(routeId, route.from, route.to);
      this.activeVideoRoutes.add(routeId);
    }
  }

  private applyMessageObjectRoute(route: PatchbayRoute): void {
    const routeId = this.getMessageRouteId(route);
    const sourceNodeId = route.fromEndpoint?.nodeId ?? `${routeId}:message-source:${route.from}`;
    const targetNodeId = route.toEndpoint?.nodeId ?? `${routeId}:message-target:${route.to}`;

    getPatchbayMessageRuntime().registerEdge(routeId, {
      id: routeId,
      source: sourceNodeId,
      target: targetNodeId,
      sourceHandle: route.fromEndpoint?.handle ?? 'message-out',
      targetHandle: route.toEndpoint?.handle ?? 'message-in'
    });
    this.activeMessageEdges.add(routeId);

    if (!route.fromEndpoint) {
      const subscriberId = `${routeId}:message-channel-source`;
      this.channelRegistry.subscribe(route.from, subscriberId, (message) => {
        getPatchbayMessageRuntime().sendFromEndpoint(sourceNodeId, message);
      });
      this.trackMessageSubscription(route.from, subscriberId);
    }

    if (!route.toEndpoint) {
      getPatchbayMessageRuntime().registerEndpoint(targetNodeId, (message) => {
        this.channelRegistry.broadcast(route.to, message, this.nodeId);
      });
      this.activeMessageEndpoints.add(targetNodeId);
    }
  }

  private applyAudioObjectRoute(route: PatchbayRoute): void {
    const routeId = this.getAudioObjectRouteId(route);
    const sourceNodeId =
      route.fromEndpoint?.nodeId ?? `${routeId}:audio-recv:${route.from}:audio-send:obj`;
    const targetNodeId =
      route.toEndpoint?.nodeId ?? `${routeId}:audio-recv:obj:audio-send:${route.to}`;

    getPatchbayAudioRuntime().registerEdge(routeId, {
      id: routeId,
      source: sourceNodeId,
      target: targetNodeId,
      sourceHandle: route.fromEndpoint?.handle ?? 'audio-out',
      targetHandle: route.toEndpoint?.handle ?? 'audio-in'
    });
    this.activeAudioEdges.add(routeId);

    if (!route.fromEndpoint) {
      this.audioChannelRegistry.subscribe(route.from, sourceNodeId, 'recv');
      this.activeAudioRoutes.set(sourceNodeId, route);
    }

    if (!route.toEndpoint) {
      this.audioChannelRegistry.subscribe(route.to, targetNodeId, 'send');
      this.activeAudioRoutes.set(targetNodeId, route);
    }
  }

  private applyVideoObjectRoute(route: PatchbayRoute): void {
    const routeId = this.getVideoObjectRouteId(route);
    let sourceNodeId = route.fromEndpoint?.nodeId;
    let sourceHandle = route.fromEndpoint?.handle;
    let targetNodeId = route.toEndpoint?.nodeId;
    let targetHandle = route.toEndpoint?.handle;

    if (!route.fromEndpoint) {
      const sourceRouteId = `${routeId}:channel-source`;
      const syntheticChannel = `${sourceRouteId}:video-channel`;
      getPatchbayVideoRuntime().registerRoute(sourceRouteId, route.from, syntheticChannel);
      this.activeVideoRoutes.add(sourceRouteId);
      sourceNodeId = `${sourceRouteId}:video-send:${syntheticChannel}`;
      sourceHandle = 'video-out';
    }

    if (!route.toEndpoint) {
      const targetRouteId = `${routeId}:channel-target`;
      const syntheticChannel = `${targetRouteId}:video-channel`;
      getPatchbayVideoRuntime().registerRoute(targetRouteId, syntheticChannel, route.to);
      this.activeVideoRoutes.add(targetRouteId);
      targetNodeId = `${targetRouteId}:video-recv:${syntheticChannel}`;
      targetHandle = 'video-in-0';
    }

    getPatchbayVideoRuntime().registerEdge(routeId, {
      id: routeId,
      source: sourceNodeId!,
      target: targetNodeId!,
      sourceHandle,
      targetHandle
    });
    this.activeVideoEdges.add(routeId);
  }

  private groupRoutesBySource(routes: PatchbayRoute[]): RouteMap {
    const routesBySource: RouteMap = new Map();

    for (const route of routes) {
      if (!routesBySource.has(route.from)) {
        routesBySource.set(route.from, []);
      }

      routesBySource.get(route.from)!.push(route.to);
    }

    return routesBySource;
  }

  private clearSubscriptions(): void {
    for (const [source, subscriberIds] of this.activeMessageSubscriptions) {
      for (const subscriberId of subscriberIds) {
        this.channelRegistry.unsubscribe(source, subscriberId);
      }
    }

    this.activeMessageSubscriptions.clear();
  }

  private trackMessageSubscription(source: string, subscriberId: string): void {
    const subscriberIds = this.activeMessageSubscriptions.get(source) ?? new Set<string>();
    subscriberIds.add(subscriberId);
    this.activeMessageSubscriptions.set(source, subscriberIds);
  }

  private clearMessageEdges(): void {
    for (const routeId of this.activeMessageEdges) {
      getPatchbayMessageRuntime().unregisterEdge(routeId);
    }

    this.activeMessageEdges.clear();
  }

  private clearMessageEndpoints(): void {
    for (const nodeId of this.activeMessageEndpoints) {
      getPatchbayMessageRuntime().unregisterEndpoint(nodeId);
    }

    this.activeMessageEndpoints.clear();
  }

  private clearAudioRoutes(): void {
    for (const routeId of this.activeAudioEdges) {
      getPatchbayAudioRuntime().unregisterEdge(routeId);
    }
    this.activeAudioEdges.clear();

    for (const [endpointId, route] of this.activeAudioRoutes) {
      this.audioChannelRegistry.unsubscribe(route.from, endpointId);
      this.audioChannelRegistry.unsubscribe(route.to, endpointId);
    }

    this.activeAudioRoutes.clear();
  }

  private clearVideoRoutes(): void {
    for (const routeId of this.activeVideoEdges) {
      getPatchbayVideoRuntime().unregisterEdge(routeId);
    }
    this.activeVideoEdges.clear();

    for (const routeId of this.activeVideoRoutes) {
      getPatchbayVideoRuntime().unregisterRoute(routeId);
    }

    this.activeVideoRoutes.clear();
  }

  private getSubscriberId(source: string): string {
    return `${this.nodeId}:message:${source}`;
  }

  private getAudioEndpointId(route: PatchbayRoute): string {
    return `${this.nodeId}:audio-recv:${route.from}:audio-send:${route.to}`;
  }

  private getVideoRouteId(route: PatchbayRoute): string {
    return `${this.nodeId}:video-route:${route.from}->${route.to}`;
  }

  private getMessageRouteId(route: PatchbayRoute): string {
    return `${this.nodeId}:message-edge:${route.from}->${route.to}`;
  }

  private getAudioObjectRouteId(route: PatchbayRoute): string {
    return `${this.nodeId}:audio-edge:${route.from}->${route.to}`;
  }

  private getVideoObjectRouteId(route: PatchbayRoute): string {
    return `${this.nodeId}:video-edge:${route.from}->${route.to}`;
  }
}
