import { SvelteMap } from 'svelte/reactivity';
import { hash } from 'ohash';
import { PatchiesEventBus } from '$lib/eventbus/PatchiesEventBus';
import { MessageContext } from '$lib/messages/MessageContext';
import type { MessageCallbackFn } from '$lib/messages/MessageSystem';
import type { TextObjectV2 } from '$lib/objects/v2/interfaces/text-objects';
import type { ObjectInlet, ObjectMetadata, ObjectOutlet } from '$lib/objects/v2/object-metadata';

type ObjectParamsChangedEvent = {
  type: 'objectParamsChanged';
  nodeId: string;
  params: unknown[];
};

export type RuntimeObjectDescriptor = {
  id: string;
  objectType: string;
  params: unknown[];
  rawParams: string[];
};

type RuntimeObjectRecord = {
  objectType: string;
  lifecycleKey: string;
  messageContext: MessageContext;
  lifecycleToken: number;
};

export type RuntimeObjectService = {
  createObject(
    nodeId: string,
    objectType: string,
    messageContext: MessageContext,
    params?: unknown[],
    rawParams?: string[]
  ): Promise<TextObjectV2 | null>;

  isObjectInRegistry(objectType: string): boolean;
  getObjectById(nodeId: string): TextObjectV2 | null;
  removeObjectById(nodeId: string): void;
};

export type RuntimeEventBus = {
  addEventListener(
    type: 'objectParamsChanged',
    listener: (event: ObjectParamsChangedEvent) => void
  ): void;

  removeEventListener(
    type: 'objectParamsChanged',
    listener: (event: ObjectParamsChangedEvent) => void
  ): void;
};

export type RuntimeObjectPorts = {
  inlets: ObjectInlet[];
  outlets: ObjectOutlet[];
  hasDynamicOutlets: boolean;
};

export type PatchMessageRuntimeOptions = {
  objectService: RuntimeObjectService;
  eventBus?: RuntimeEventBus;
  onObjectParamsChange?: (nodeId: string, params: unknown[]) => void;
};

export class PatchMessageRuntime {
  private objectService: RuntimeObjectService;
  private eventBus: RuntimeEventBus;
  private onObjectParamsChange?: (nodeId: string, params: unknown[]) => void;
  private objects = new Map<string, RuntimeObjectRecord>();
  private objectMessageContexts = new SvelteMap<string, MessageContext>();
  private objectViewRevisions = new SvelteMap<string, number>();
  private objectLifecycleTokens = new Map<string, number>();

  constructor(options: PatchMessageRuntimeOptions) {
    this.objectService = options.objectService;
    this.eventBus = options.eventBus ?? PatchiesEventBus.getInstance();

    this.onObjectParamsChange = options.onObjectParamsChange;
    this.eventBus.addEventListener('objectParamsChanged', this.handleObjectParamsChanged);
  }

  isObjectInRegistry(objectType: string): boolean {
    return this.objectService.isObjectInRegistry(objectType);
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
      descriptor.params,
      descriptor.rawParams
    );

    if (!this.isCurrentObjectLifecycleToken(descriptor.id, lifecycleToken)) {
      return;
    }

    if (!object) {
      this.bumpObjectViewRevision(descriptor.id);
      return;
    }

    const params = object.context.getParams();

    if (hasParamChanges(descriptor.params, params)) {
      this.onObjectParamsChange?.(descriptor.id, params);
    }

    this.bumpObjectViewRevision(descriptor.id);
  }

  async updateObject(nodeId: string, descriptor: RuntimeObjectDescriptor): Promise<void> {
    const existing = this.objects.get(nodeId);
    const lifecycleKey = getObjectLifecycleKey(descriptor);

    const canSkipUpdate =
      existing &&
      existing.objectType === descriptor.objectType &&
      existing.lifecycleKey === lifecycleKey;

    if (canSkipUpdate) return;

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
    this.bumpObjectViewRevision(nodeId);
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
      this.bumpObjectViewRevision(nodeId);
    }
  }

  getObjectMessageContext(nodeId: string): MessageContext | null {
    return this.objectMessageContexts.get(nodeId) ?? null;
  }

  subscribeObjectMessages(nodeId: string, callback: MessageCallbackFn): (() => void) | null {
    const messageContext = this.getObjectMessageContext(nodeId);
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
    const objectInstance = this.objectService.getObjectById(nodeId);

    return {
      inlets: objectInstance?.getInlets?.() ?? objectMeta?.inlets ?? [],
      outlets: objectInstance?.getOutlets?.() ?? objectMeta?.outlets ?? [],
      hasDynamicOutlets: !!objectInstance?.getOutlets
    };
  }

  /**
   * Reads the object's view revision from a SvelteMap so callers inside
   * `$derived`/`$effect` track runtime object changes as a reactive dependency.
   */
  trackObjectViewRevision(nodeId: string): number {
    return this.objectViewRevisions.get(nodeId) ?? 0;
  }

  destroy(): void {
    this.eventBus.removeEventListener('objectParamsChanged', this.handleObjectParamsChanged);

    for (const nodeId of [...this.objects.keys()]) {
      this.destroyObject(nodeId);
    }
  }

  private handleObjectParamsChanged = (event: ObjectParamsChangedEvent) => {
    this.onObjectParamsChange?.(event.nodeId, event.params);
    this.bumpObjectViewRevision(event.nodeId);
  };

  private bumpObjectViewRevision(nodeId: string): void {
    this.objectViewRevisions.set(nodeId, (this.objectViewRevisions.get(nodeId) ?? 0) + 1);
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
