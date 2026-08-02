import type { Edge } from '@xyflow/svelte';

import type { PatchiesEventBus } from '$lib/eventbus';
import type { ObjectDataChangedEvent } from '$lib/eventbus/events';
import type { ObjectMetadata, ObjectService } from '$lib/objects';
import { MessageContext, type MessageCallbackFn, type MessageSystem } from '$lib/messages';

import { RuntimeViewRevisionTracker } from '../services/RuntimeViewRevisionTracker';

import type {
  RuntimeObjectSpec,
  RuntimeObjectPorts,
  RuntimeObjectViewRevisionListener
} from '../types/runtime-object';

import { getObjectLifecycleKey } from '../utils/runtime-object-keys';
import { getRawObjectParamsFromExpr } from '../utils/runtime-object-data';
import { diffNodeData, hasParamChanges } from '../utils/runtime-diff-utils';

type ObjectParamsChangedEvent = {
  type: 'objectParamsChanged';
  nodeId: string;
  params: unknown[];
};

type RuntimeObject = {
  objectType: string;

  lifecycleKey: string;
  lifecycleToken: number;

  messageContext: MessageContext;
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

  private objects = new Map<string, RuntimeObject>();

  // Kept outside objects so an async create can be invalidated after its entry is removed.
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

  async createObject(spec: RuntimeObjectSpec): Promise<void> {
    this.removeObject(spec.id, {
      bumpRevision: false,
      unregisterNodeFromMessageSystem: false
    });

    const messageContext = new MessageContext(spec.id);

    const lifecycleToken = this.nextObjectLifecycleToken(spec.id);
    const lifecycleKey = getObjectLifecycleKey(spec);

    this.objects.set(spec.id, {
      objectType: spec.type,
      lifecycleKey,
      messageContext,
      lifecycleToken
    });

    const rawParams = getRawObjectParamsFromExpr(spec.data.expr);

    const object = await this.objectService.createObject(
      spec.id,
      spec.type,
      messageContext,
      spec.data,
      rawParams
    );

    if (!this.isCurrentObjectLifecycleToken(spec.id, lifecycleToken)) {
      return;
    }

    if (!object) {
      this.viewRevisions.bump(spec.id);
      return;
    }

    const params = object.context.getParams();
    const data = object.context.getData();

    if (Array.isArray(spec.data.params) && hasParamChanges(spec.data.params, params)) {
      this.onObjectParamsChange?.(spec.id, params);
    }

    const dataDiffs = diffNodeData(spec.data, data);

    if (Object.keys(dataDiffs).length > 0) {
      this.onObjectDataChange?.(spec.id, dataDiffs);
    }

    this.viewRevisions.bump(spec.id);
  }

  async updateObject(nodeId: string, spec: RuntimeObjectSpec): Promise<void> {
    const existing = this.objects.get(nodeId);
    const lifecycleKey = getObjectLifecycleKey(spec);

    const canSkipUpdate =
      existing && existing.objectType === spec.type && existing.lifecycleKey === lifecycleKey;

    if (canSkipUpdate) {
      const object = this.objectService.getObjectById(nodeId);

      object?.context.setData(spec.data);
      object?.update?.(spec.data);

      if (object) {
        const dataDiffs = diffNodeData(spec.data, object.context.getData());

        if (Object.keys(dataDiffs).length > 0) {
          this.onObjectDataChange?.(nodeId, dataDiffs);
        }
      }

      this.viewRevisions.bump(nodeId);

      return;
    }

    await this.createObject(spec);
  }

  destroyObject(nodeId: string): void {
    const object = this.objects.get(nodeId);
    if (!object) return;

    this.objectService.removeObjectById(nodeId);
    object.messageContext.destroy();

    this.objects.delete(nodeId);

    this.nextObjectLifecycleToken(nodeId);
    this.viewRevisions.bump(nodeId);
  }

  getObjectMessageContext(nodeId: string): MessageContext | null {
    return this.objects.get(nodeId)?.messageContext ?? null;
  }

  subscribeObjectMessages(nodeId: string, callback: MessageCallbackFn): (() => void) | null {
    const messageContext = this.objects.get(nodeId)?.messageContext;
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
    options: { bumpRevision: boolean; unregisterNodeFromMessageSystem?: boolean }
  ): void {
    const object = this.objects.get(nodeId);
    if (!object) return;

    this.objectService.removeObjectById(nodeId);

    object.messageContext.destroy({
      unregisterNode: options.unregisterNodeFromMessageSystem ?? true
    });

    this.objects.delete(nodeId);

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
    const object = this.objects.get(nodeId);

    return (
      object?.lifecycleToken === lifecycleToken &&
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
