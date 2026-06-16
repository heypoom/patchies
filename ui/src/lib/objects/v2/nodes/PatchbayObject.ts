import { Type } from '@sinclair/typebox';
import { hash } from 'ohash';
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
import type { Edge, Node } from '@xyflow/svelte';

type RouteMap = Map<string, string[]>;

type PatchbayObjectOptions = {
  getNodes?: () => Array<Pick<Node, 'id' | 'type' | 'data'>>;
};

export class PatchbayObject implements TextObjectV2 {
  static type = 'patchbay';
  static description = 'Route named channels with a compact text patchbay';
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
  private activeAudioVirtualExpressions = new Set<string>();

  private activeVideoRoutes = new Map<string, { from: string; to: string }>();
  private activeVideoEdges = new Map<string, string>();

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

    this.unsubscribeParamsChange = this.context.onParamsChange(() => {
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
      objects: objectPorts,

      messageSources: new Set(this.channelRegistry.getSenderChannelNames()),
      messageTargets: new Set(this.channelRegistry.getReceiverChannelNames()),

      audioSources: new Set(this.audioChannelRegistry.getSenderChannelNames()),
      audioTargets: new Set(this.audioChannelRegistry.getReceiverChannelNames()),

      videoSources: new Set(this.videoChannelRegistry.getSenderChannelNames()),
      videoTargets: new Set(this.videoChannelRegistry.getReceiverChannelNames())
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
    return hash({
      code: this.getCode(),

      objects: Array.from(objectPorts.entries())
        .map(([nodeId, ports]) => [nodeId, ports])
        .sort(([a], [b]) => String(a).localeCompare(String(b))),

      messageSources: this.channelRegistry.getSenderChannelNames().sort(),
      messageTargets: this.channelRegistry.getReceiverChannelNames().sort(),

      audioSources: this.audioChannelRegistry.getSenderChannelNames().sort(),
      audioTargets: this.audioChannelRegistry.getReceiverChannelNames().sort(),

      videoSources: this.videoChannelRegistry.getSenderChannelNames().sort(),
      videoTargets: this.videoChannelRegistry.getReceiverChannelNames().sort()
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

    const routesWithEndpoint = routes.filter((route) => route.fromEndpoint || route.toEndpoint);

    for (const route of routesWithEndpoint) {
      this.applyMessageObjectRoute(route);
    }
  }

  private applyAudioRoutes(routes: PatchbayRoute[]): void {
    this.clearAudioRoutes();

    for (const route of routes) {
      if (
        route.fromEndpoint ||
        route.toEndpoint ||
        route.fromVirtualExpression ||
        route.toVirtualExpression
      ) {
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
    const desiredRoutes = new Map<string, { from: string; to: string }>();
    const desiredEdges = new Map<string, Edge>();

    for (const route of routes) {
      if (route.fromEndpoint || route.toEndpoint) {
        this.collectVideoObjectRoute(route, desiredRoutes, desiredEdges);

        continue;
      }

      const routeId = this.getVideoRouteId(route);
      desiredRoutes.set(routeId, { from: route.from, to: route.to });
    }

    this.reconcileVideoRoutes(desiredRoutes);
    this.reconcileVideoEdges(desiredEdges);
  }

  private reconcileVideoRoutes(desiredRoutes: Map<string, { from: string; to: string }>): void {
    const runtime = getPatchbayVideoRuntime();

    for (const routeId of this.activeVideoRoutes.keys()) {
      if (!desiredRoutes.has(routeId)) {
        runtime.unregisterRoute(routeId);
        this.activeVideoRoutes.delete(routeId);
      }
    }

    for (const [routeId, route] of desiredRoutes) {
      const activeRoute = this.activeVideoRoutes.get(routeId);

      if (activeRoute?.from === route.from && activeRoute?.to === route.to) {
        continue;
      }

      runtime.registerRoute(routeId, route.from, route.to);
      this.activeVideoRoutes.set(routeId, route);
    }
  }

  private reconcileVideoEdges(desiredEdges: Map<string, Edge>): void {
    const runtime = getPatchbayVideoRuntime();

    for (const routeId of this.activeVideoEdges.keys()) {
      if (!desiredEdges.has(routeId)) {
        runtime.unregisterEdge(routeId);
        this.activeVideoEdges.delete(routeId);
      }
    }

    for (const [routeId, edge] of desiredEdges) {
      const signature = hash(edge);
      if (this.activeVideoEdges.get(routeId) === signature) continue;

      runtime.registerEdge(routeId, edge);
      this.activeVideoEdges.set(routeId, signature);
    }
  }

  private applyMessageObjectRoute(route: PatchbayRoute): void {
    const routeId = this.getMessageRouteId(route);
    const runtime = getPatchbayMessageRuntime();

    const sourceNodeId = route.fromEndpoint?.nodeId ?? `${routeId}:message-source:${route.from}`;
    const targetNodeId = route.toEndpoint?.nodeId ?? `${routeId}:message-target:${route.to}`;

    runtime.registerEdge(routeId, {
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
        runtime.sendFromEndpoint(sourceNodeId, message);
      });

      this.trackMessageSubscription(route.from, subscriberId);
    }

    if (!route.toEndpoint) {
      runtime.registerEndpoint(targetNodeId, (message) => {
        this.channelRegistry.broadcast(route.to, message, this.nodeId);
      });

      this.activeMessageEndpoints.add(targetNodeId);
    }
  }

  private applyAudioObjectRoute(route: PatchbayRoute): void {
    const routeId = this.getAudioObjectRouteId(route);

    if (route.fromVirtualExpression) {
      this.registerAudioVirtualExpression(route.fromVirtualExpression);
    }

    if (route.toVirtualExpression) {
      this.registerAudioVirtualExpression(route.toVirtualExpression);
    }

    const sourceNodeId =
      route.fromEndpoint?.nodeId ??
      route.fromVirtualExpression?.id ??
      `${routeId}:audio-recv:${route.from}:audio-send:obj`;

    const targetNodeId =
      route.toEndpoint?.nodeId ??
      route.toVirtualExpression?.id ??
      `${routeId}:audio-recv:obj:audio-send:${route.to}`;

    getPatchbayAudioRuntime().registerEdge(routeId, {
      id: routeId,
      source: sourceNodeId,
      target: targetNodeId,
      sourceHandle: route.fromEndpoint?.handle ?? 'audio-out',
      targetHandle:
        route.toEndpoint?.handle ?? (route.toVirtualExpression ? 'audio-in-0' : 'audio-in')
    });

    this.activeAudioEdges.add(routeId);

    if (!route.fromEndpoint && !route.fromVirtualExpression) {
      this.audioChannelRegistry.subscribe(route.from, sourceNodeId, 'recv');
      this.activeAudioRoutes.set(sourceNodeId, route);
    }

    if (!route.toEndpoint && !route.toVirtualExpression) {
      this.audioChannelRegistry.subscribe(route.to, targetNodeId, 'send');
      this.activeAudioRoutes.set(targetNodeId, route);
    }
  }

  private registerAudioVirtualExpression(
    expression: NonNullable<PatchbayRoute['fromVirtualExpression']>
  ): void {
    if (this.activeAudioVirtualExpressions.has(expression.id)) return;

    getPatchbayAudioRuntime().registerVirtualExpression?.(expression.id, {
      nodeId: expression.id,
      expression: expression.expression
    });

    this.activeAudioVirtualExpressions.add(expression.id);
  }

  private collectVideoObjectRoute(
    route: PatchbayRoute,
    desiredRoutes: Map<string, { from: string; to: string }>,
    desiredEdges: Map<string, Edge>
  ): void {
    const routeId = this.getVideoObjectRouteId(route);

    let sourceNodeId = route.fromEndpoint?.nodeId;
    let sourceHandle = route.fromEndpoint?.handle;

    let targetNodeId = route.toEndpoint?.nodeId;
    let targetHandle = route.toEndpoint?.handle;

    if (!route.fromEndpoint) {
      const sourceRouteId = `${routeId}:channel-source`;
      const syntheticChannel = `${sourceRouteId}:video-channel`;

      desiredRoutes.set(sourceRouteId, { from: route.from, to: syntheticChannel });

      sourceNodeId = `${sourceRouteId}:video-send:${syntheticChannel}`;
      sourceHandle = 'video-out';
    }

    if (!route.toEndpoint) {
      const targetRouteId = `${routeId}:channel-target`;
      const syntheticChannel = `${targetRouteId}:video-channel`;

      desiredRoutes.set(targetRouteId, { from: syntheticChannel, to: route.to });

      targetNodeId = `${targetRouteId}:video-recv:${syntheticChannel}`;
      targetHandle = 'video-in-0';
    }

    desiredEdges.set(routeId, {
      id: routeId,
      source: sourceNodeId!,
      target: targetNodeId!,
      sourceHandle,
      targetHandle
    });
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

    for (const routeId of this.activeAudioVirtualExpressions) {
      getPatchbayAudioRuntime().unregisterVirtualExpression?.(routeId);
    }

    this.activeAudioVirtualExpressions.clear();
  }

  private clearVideoRoutes(): void {
    const runtime = getPatchbayVideoRuntime();

    for (const routeId of this.activeVideoEdges.keys()) {
      runtime.unregisterEdge(routeId);
    }

    this.activeVideoEdges.clear();

    for (const routeId of this.activeVideoRoutes.keys()) {
      runtime.unregisterRoute(routeId);
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
