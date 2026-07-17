import type { Edge } from '@xyflow/svelte';

import type { PatchiesEventBus } from '$lib/eventbus';
import type { ObjectMetadata, ObjectService } from '$lib/objects';
import { MessageContext, type MessageCallbackFn, type MessageSystem } from '$lib/messages';

import { RuntimeViewRevisionTracker } from '../services/RuntimeViewRevisionTracker';

import type {
  RuntimeObjectDescriptor,
  RuntimeObjectPorts,
  RuntimeObjectViewRevisionListener
} from '../types/runtime-object';

import { getObjectLifecycleKey } from '../utils/runtime-object-keys';
import { diffNodeData, hasParamChanges } from '../utils/runtime-diff-utils';

type ObjectParamsChangedEvent = {
  type: 'objectParamsChanged';
  nodeId: string;
  params: unknown[];
};

type ObjectDataChangedEvent = {
  type: 'objectDataChanged';
  nodeId: string;
  data: Record<string, unknown>;
  updates: Record<string, unknown>;
};

type RuntimeObjectRecord = {
  messageContext: MessageContext;
  objectType: string;
  lifecycleKey: string;
  lifecycleToken: number;
};

type MessageAdapterOptions = {
  objectService: ObjectService;
  eventBus: PatchiesEventBus;
  messageSystem: Pick<MessageSystem, 'updateEdges'>;

  onObjectParamsChange?: (nodeId: string, params: unknown[]) => void;
  onObjectDataChange?: (nodeId: string, updates: Record<string, unknown>) => void;
};

export class MessageAdapter {
  readonly objectService: ObjectService;

  private eventBus: PatchiesEventBus;
  private messageSystem: Pick<MessageSystem, 'updateEdges'>;

  private viewRevisions = new RuntimeViewRevisionTracker();

  private onObjectParamsChange?: (nodeId: string, params: unknown[]) => void;
  private onObjectDataChange?: (nodeId: string, updates: Record<string, unknown>) => void;

  private objects = new Map<string, RuntimeObjectRecord>();
  private objectMessageContexts = new Map<string, MessageContext>();
  private objectLifecycleTokens = new Map<string, number>();

  constructor(options: MessageAdapterOptions) {
    this.objectService = options.objectService;
    this.eventBus = options.eventBus;
    this.messageSystem = options.messageSystem;

    this.onObjectParamsChange = options.onObjectParamsChange;
    this.onObjectDataChange = options.onObjectDataChange;

    this.eventBus.addEventListener('objectParamsChanged', this.handleObjectParamsChanged);
    this.eventBus.addEventListener('objectDataChanged', this.handleObjectDataChanged);
  }

  async createObject(descriptor: RuntimeObjectDescriptor): Promise<void> {
    this.removeObject(descriptor.id, {
      bumpRevision: false,
      unregisterMessageNode: false
    });

    const messageContext = new MessageContext(descriptor.id);

    const lifecycleToken = this.nextObjectLifecycleToken(descriptor.id);
    const lifecycleKey = getObjectLifecycleKey(descriptor);

    this.objects.set(descriptor.id, {
      objectType: descriptor.objectType,
      lifecycleKey,
      messageContext,
      lifecycleToken
    });

    this.objectMessageContexts.set(descriptor.id, messageContext);

    const object = await this.objectService.createObject(
      descriptor.id,
      descriptor.objectType,
      messageContext,
      descriptor.data,
      descriptor.rawParams
    );

    if (!this.isCurrentObjectLifecycleToken(descriptor.id, lifecycleToken)) {
      return;
    }

    if (!object) {
      this.viewRevisions.bump(descriptor.id);
      return;
    }

    const params = object.context.getParams();
    const data = object.context.getData();

    if (Array.isArray(descriptor.data.params) && hasParamChanges(descriptor.data.params, params)) {
      this.onObjectParamsChange?.(descriptor.id, params);
    }

    const dataUpdates = diffNodeData(descriptor.data, data);

    if (Object.keys(dataUpdates).length > 0) {
      this.onObjectDataChange?.(descriptor.id, dataUpdates);
    }

    this.viewRevisions.bump(descriptor.id);
  }

  async updateObject(nodeId: string, descriptor: RuntimeObjectDescriptor): Promise<void> {
    const existing = this.objects.get(nodeId);
    const lifecycleKey = getObjectLifecycleKey(descriptor);

    const canSkipUpdate =
      existing &&
      existing.objectType === descriptor.objectType &&
      existing.lifecycleKey === lifecycleKey;

    if (canSkipUpdate) {
      const object = this.objectService.getObjectById(nodeId);

      object?.context.setData(descriptor.data);
      object?.update?.(descriptor.data);

      return;
    }

    await this.createObject(descriptor);
  }

  destroyObject(nodeId: string): void {
    const record = this.objects.get(nodeId);
    if (!record) return;

    this.objectService.removeObjectById(nodeId);
    record.messageContext.destroy();

    this.objects.delete(nodeId);
    this.objectMessageContexts.delete(nodeId);

    this.nextObjectLifecycleToken(nodeId);
    this.viewRevisions.bump(nodeId);
  }

  getObjectMessageContext(nodeId: string): MessageContext | null {
    return this.objectMessageContexts.get(nodeId) ?? null;
  }

  subscribeObjectMessages(nodeId: string, callback: MessageCallbackFn): (() => void) | null {
    const messageContext = this.objectMessageContexts.get(nodeId);
    if (!messageContext) return null;

    messageContext.queue.addCallback(callback);

    return () => messageContext.queue.removeCallback(callback);
  }

  updateEdges(edges: Edge[]): void {
    this.messageSystem.updateEdges(edges);
  }

  getObjectPorts(
    nodeId: string,
    objectMeta: Pick<ObjectMetadata, 'inlets' | 'outlets'> | null | undefined
  ): RuntimeObjectPorts {
    const objectInstance = this.objectService.getObjectById(nodeId);

    return {
      inlets: objectInstance?.getInlets?.() ?? objectMeta?.inlets ?? [],
      outlets: objectInstance?.getOutlets?.() ?? objectMeta?.outlets ?? [],
      hasDynamicOutlets: !!objectInstance?.getOutlets
    };
  }

  trackObjectViewRevision(nodeId: string): number {
    return this.viewRevisions.track(nodeId);
  }

  subscribeObjectViewRevisions(listener: RuntimeObjectViewRevisionListener): () => void {
    return this.viewRevisions.subscribe(listener);
  }

  destroy(): void {
    this.eventBus.removeEventListener('objectParamsChanged', this.handleObjectParamsChanged);
    this.eventBus.removeEventListener('objectDataChanged', this.handleObjectDataChanged);

    for (const nodeId of this.objects.keys()) {
      this.destroyObject(nodeId);
    }
  }

  private removeObject(
    nodeId: string,
    options: { bumpRevision: boolean; unregisterMessageNode?: boolean }
  ): void {
    const record = this.objects.get(nodeId);
    if (!record) return;

    this.objectService.removeObjectById(nodeId);
    record.messageContext.destroy({ unregisterNode: options.unregisterMessageNode ?? true });

    this.objects.delete(nodeId);
    this.objectMessageContexts.delete(nodeId);

    if (options.bumpRevision) {
      this.nextObjectLifecycleToken(nodeId);
      this.viewRevisions.bump(nodeId);
    }
  }

  private nextObjectLifecycleToken(nodeId: string): number {
    const lifecycleToken = (this.objectLifecycleTokens.get(nodeId) ?? 0) + 1;
    this.objectLifecycleTokens.set(nodeId, lifecycleToken);

    return lifecycleToken;
  }

  private isCurrentObjectLifecycleToken(nodeId: string, lifecycleToken: number): boolean {
    const record = this.objects.get(nodeId);

    return (
      record?.lifecycleToken === lifecycleToken &&
      this.objectLifecycleTokens.get(nodeId) === lifecycleToken
    );
  }

  private handleObjectParamsChanged = (event: ObjectParamsChangedEvent) => {
    this.onObjectParamsChange?.(event.nodeId, event.params);
    this.viewRevisions.bump(event.nodeId);
  };

  private handleObjectDataChanged = (event: ObjectDataChangedEvent) => {
    this.onObjectDataChange?.(event.nodeId, event.updates);
    this.viewRevisions.bump(event.nodeId);
  };
}
