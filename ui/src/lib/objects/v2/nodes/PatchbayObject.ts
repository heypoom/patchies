import { Type } from '@sinclair/typebox';
import { match } from 'ts-pattern';

import { AudioChannelRegistry } from '$lib/audio/AudioChannelRegistry';
import { MessageChannelRegistry } from '$lib/messages/MessageChannelRegistry';
import {
  analyzePatchbay,
  type PatchbayDiagnostic,
  type PatchbayRoute
} from '$lib/patchbay/patchbay-parser';

import type { ObjectContext } from '../ObjectContext';
import type { ObjectInlet } from '../object-metadata';
import type { MessageMeta, TextObjectV2 } from '../interfaces/text-objects';

type RouteMap = Map<string, string[]>;

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
  private activeMessageSubscriptions = new Set<string>();
  private activeAudioRoutes = new Map<string, PatchbayRoute>();
  private currentDiagnostics: PatchbayDiagnostic[] = [];
  private unsubscribeRegistryChange: (() => void) | null = null;
  private unsubscribeAudioRegistryChange: (() => void) | null = null;

  constructor(nodeId: string, context: ObjectContext) {
    this.nodeId = nodeId;
    this.context = context;
  }

  create(rawParams: unknown[]): void {
    if (this.getCode().trim().length === 0 && rawParams.length > 0) {
      this.context.setParam('code', rawParams.join(' '));
    }

    this.applyCode();

    this.context.onParamsChange((_params, _index, _value) => {
      this.applyCode();
    });

    this.unsubscribeRegistryChange = this.channelRegistry.onChannelsChange(() => {
      this.applyCode();
    });
    this.unsubscribeAudioRegistryChange = this.audioChannelRegistry.onChannelsChange(() => {
      this.applyCode();
    });
  }

  get diagnostics(): PatchbayDiagnostic[] {
    return [...this.currentDiagnostics];
  }

  applyCode(): void {
    const analysis = analyzePatchbay(this.getCode(), {
      messageSources: new Set(this.channelRegistry.getSenderChannelNames()),
      messageTargets: new Set(this.channelRegistry.getReceiverChannelNames()),
      audioSources: new Set(this.audioChannelRegistry.getSenderChannelNames()),
      audioTargets: new Set(this.audioChannelRegistry.getReceiverChannelNames())
    });
    this.currentDiagnostics = analysis.diagnostics;

    if (analysis.diagnostics.some((diagnostic) => diagnostic.severity === 'error')) {
      return;
    }

    this.applyMessageRoutes(analysis.messageRoutes);
    this.applyAudioRoutes(analysis.audioRoutes);
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
    this.unsubscribeRegistryChange?.();
    this.unsubscribeRegistryChange = null;
    this.unsubscribeAudioRegistryChange?.();
    this.unsubscribeAudioRegistryChange = null;
    this.clearSubscriptions();
    this.clearAudioRoutes();
  }

  private getCode(): string {
    const code = this.context.getParam('code');
    return typeof code === 'string' ? code : '';
  }

  private applyMessageRoutes(routes: PatchbayRoute[]): void {
    this.clearSubscriptions();

    const routesBySource = this.groupRoutesBySource(routes);

    for (const [source, destinations] of routesBySource) {
      const subscriberId = this.getSubscriberId(source);
      this.channelRegistry.subscribe(source, subscriberId, (message) => {
        for (const destination of destinations) {
          this.channelRegistry.broadcast(destination, message, this.nodeId);
        }
      });
      this.activeMessageSubscriptions.add(source);
    }
  }

  private applyAudioRoutes(routes: PatchbayRoute[]): void {
    this.clearAudioRoutes();

    for (const route of routes) {
      const endpointId = this.getAudioEndpointId(route);

      this.audioChannelRegistry.subscribe(route.from, endpointId, 'recv');
      this.audioChannelRegistry.subscribe(route.to, endpointId, 'send');
      this.activeAudioRoutes.set(endpointId, route);
    }
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
    for (const source of this.activeMessageSubscriptions) {
      this.channelRegistry.unsubscribe(source, this.getSubscriberId(source));
    }

    this.activeMessageSubscriptions.clear();
  }

  private clearAudioRoutes(): void {
    for (const [endpointId, route] of this.activeAudioRoutes) {
      this.audioChannelRegistry.unsubscribe(route.from, endpointId);
      this.audioChannelRegistry.unsubscribe(route.to, endpointId);
    }

    this.activeAudioRoutes.clear();
  }

  private getSubscriberId(source: string): string {
    return `${this.nodeId}:message:${source}`;
  }

  private getAudioEndpointId(route: PatchbayRoute): string {
    return `${this.nodeId}:audio-recv:${route.from}:audio-send:${route.to}`;
  }
}
