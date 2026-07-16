import type { PatchiesEventBus } from '$lib/eventbus/PatchiesEventBus';
import type { MessageCallbackFn } from '$lib/messages/MessageSystem';
import type { TextObjectClass } from '$lib/objects/v2/interfaces/text-objects';
import type { ObjectMetadata } from '$lib/objects/v2/object-metadata';

import { MessageObjectLifecycle } from '../services/MessageObjectLifecycle';
import { RuntimeViewRevisionTracker } from '../services/RuntimeViewRevisionTracker';

import type {
  RuntimeObjectDescriptor,
  RuntimeObjectPorts,
  RuntimeObjectService,
  RuntimeObjectViewRevisionListener
} from '../types/runtime-object';

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

interface MessageRuntimeOptions {
  objectService: RuntimeObjectService;
  eventBus: PatchiesEventBus;

  onObjectParamsChange?: (nodeId: string, params: unknown[]) => void;
  onObjectDataChange?: (nodeId: string, updates: Record<string, unknown>) => void;
}

export class MessageRuntime {
  private objectService: RuntimeObjectService;
  private eventBus: PatchiesEventBus;
  private lifecycle: MessageObjectLifecycle;
  private viewRevisions = new RuntimeViewRevisionTracker();

  private onObjectParamsChange?: (nodeId: string, params: unknown[]) => void;
  private onObjectDataChange?: (nodeId: string, updates: Record<string, unknown>) => void;

  constructor(options: MessageRuntimeOptions) {
    this.objectService = options.objectService;
    this.eventBus = options.eventBus;

    this.onObjectParamsChange = options.onObjectParamsChange;
    this.onObjectDataChange = options.onObjectDataChange;

    this.lifecycle = new MessageObjectLifecycle({
      objectService: options.objectService,
      onObjectParamsChange: options.onObjectParamsChange,
      onObjectDataChange: options.onObjectDataChange,
      onViewRevision: (nodeId) => this.viewRevisions.bump(nodeId)
    });

    this.eventBus.addEventListener('objectParamsChanged', this.handleObjectParamsChanged);
    this.eventBus.addEventListener('objectDataChanged', this.handleObjectDataChanged);
  }

  isObjectInRegistry(objectType: string): boolean {
    return this.objectService.isObjectInRegistry(objectType);
  }

  getObjectClass(objectType: string): TextObjectClass | undefined {
    return this.objectService.getObjectClass(objectType);
  }

  async createObject(descriptor: RuntimeObjectDescriptor): Promise<void> {
    await this.lifecycle.createObject(descriptor);
  }

  async updateObject(nodeId: string, descriptor: RuntimeObjectDescriptor): Promise<void> {
    await this.lifecycle.updateObject(nodeId, descriptor);
  }

  destroyObject(nodeId: string): void {
    this.lifecycle.destroyObject(nodeId);
  }

  getObjectMessageContext(nodeId: string) {
    return this.lifecycle.getObjectMessageContext(nodeId);
  }

  subscribeObjectMessages(nodeId: string, callback: MessageCallbackFn): (() => void) | null {
    const messageContext = this.lifecycle.getObjectMessageContext(nodeId);
    if (!messageContext) return null;

    messageContext.queue.addCallback(callback);

    return () => {
      messageContext.queue.removeCallback(callback);
    };
  }

  getObjectPorts(
    nodeId: string,
    objectMeta: Pick<ObjectMetadata, 'inlets' | 'outlets'> | null | undefined
  ): RuntimeObjectPorts {
    return this.lifecycle.getObjectPorts(nodeId, objectMeta);
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
    this.lifecycle.destroy();
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
