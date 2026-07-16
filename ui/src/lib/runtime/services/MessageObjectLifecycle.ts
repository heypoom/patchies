import { hash } from 'ohash';

import { MessageContext } from '$lib/messages/MessageContext';

import type { ObjectMetadata } from '$lib/objects/v2/object-metadata';

import type {
  RuntimeObjectDescriptor,
  RuntimeObjectPorts,
  RuntimeObjectService
} from '../types/runtime-object';

interface RuntimeObjectRecord {
  objectType: string;
  lifecycleKey: string;
  messageContext: MessageContext;
  lifecycleToken: number;
}

interface MessageObjectLifecycleOptions {
  objectService: RuntimeObjectService;
  onObjectParamsChange?: (nodeId: string, params: unknown[]) => void;
  onObjectDataChange?: (nodeId: string, updates: Record<string, unknown>) => void;
  onViewRevision?: (nodeId: string) => void;
}

export class MessageObjectLifecycle {
  private objectService: RuntimeObjectService;

  private onObjectParamsChange?: (nodeId: string, params: unknown[]) => void;
  private onObjectDataChange?: (nodeId: string, updates: Record<string, unknown>) => void;
  private onViewRevision?: (nodeId: string) => void;

  private objects = new Map<string, RuntimeObjectRecord>();
  private objectMessageContexts = new Map<string, MessageContext>();
  private objectLifecycleTokens = new Map<string, number>();

  constructor(options: MessageObjectLifecycleOptions) {
    this.objectService = options.objectService;
    this.onObjectParamsChange = options.onObjectParamsChange;
    this.onObjectDataChange = options.onObjectDataChange;
    this.onViewRevision = options.onViewRevision;
  }

  async createObject(descriptor: RuntimeObjectDescriptor): Promise<void> {
    this.removeObject(descriptor.id, {
      bumpRevision: false,
      unregisterMessageNode: false
    });

    const lifecycleToken = this.nextObjectLifecycleToken(descriptor.id);
    const messageContext = new MessageContext(descriptor.id);
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
      this.bumpViewRevision(descriptor.id);
      return;
    }

    const params = object.context.getParams();
    const data = object.context.getData();

    if (Array.isArray(descriptor.data.params) && hasParamChanges(descriptor.data.params, params)) {
      this.onObjectParamsChange?.(descriptor.id, params);
    }

    const dataUpdates = getDataUpdates(descriptor.data, data);

    if (Object.keys(dataUpdates).length > 0) {
      this.onObjectDataChange?.(descriptor.id, dataUpdates);
    }

    this.bumpViewRevision(descriptor.id);
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
    this.bumpViewRevision(nodeId);
  }

  getObjectMessageContext(nodeId: string): MessageContext | null {
    return this.objectMessageContexts.get(nodeId) ?? null;
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

  destroy(): void {
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
      this.bumpViewRevision(nodeId);
    }
  }

  private bumpViewRevision(nodeId: string): void {
    this.onViewRevision?.(nodeId);
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
}

const hasParamChanges = (currentParams: unknown[], objectParams: unknown[]): boolean =>
  currentParams.length !== objectParams.length ||
  objectParams.some((param, index) => !Object.is(param, currentParams[index]));

const getObjectLifecycleKey = (descriptor: RuntimeObjectDescriptor): string =>
  hash([descriptor.objectType, descriptor.rawParams]);

function getDataUpdates(
  currentData: Record<string, unknown>,
  objectData: Record<string, unknown>
): Record<string, unknown> {
  const updates: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(objectData)) {
    if (!Object.is(currentData[key], value)) {
      updates[key] = value;
    }
  }

  return updates;
}
