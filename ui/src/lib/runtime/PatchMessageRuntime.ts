import { SvelteMap } from 'svelte/reactivity';
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

export type PatchRuntimeObjectSpec = {
  id: string;
  objectType: string;
  params: unknown[];
  rawParams: string[];
};

type RuntimeObjectRecord = {
  objectType: string;
  lifecycleKey: string;
  messageContext: MessageContext;
  generation: number;
};

export type PatchRuntimeObjectService = {
  createObject(
    nodeId: string,
    objectType: string,
    messageContext: MessageContext,
    params?: unknown[],
    rawParams?: string[]
  ): Promise<TextObjectV2 | null>;

  isV2ObjectType(objectType: string): boolean;
  getObjectById(nodeId: string): TextObjectV2 | null;
  removeObjectById(nodeId: string): void;
};

export type PatchRuntimeEventBus = {
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
  objectService: PatchRuntimeObjectService;
  eventBus?: PatchRuntimeEventBus;
  onObjectParamsChange?: (nodeId: string, params: unknown[]) => void;
};

export class PatchMessageRuntime {
  private objectService: PatchRuntimeObjectService;
  private eventBus: PatchRuntimeEventBus;
  private onObjectParamsChange?: (nodeId: string, params: unknown[]) => void;
  private objects = new Map<string, RuntimeObjectRecord>();
  private objectMessageContexts = new SvelteMap<string, MessageContext>();
  private objectRevisions = new SvelteMap<string, number>();
  private objectGenerations = new Map<string, number>();

  constructor(options: PatchMessageRuntimeOptions) {
    this.objectService = options.objectService;
    this.eventBus = options.eventBus ?? PatchiesEventBus.getInstance();

    this.onObjectParamsChange = options.onObjectParamsChange;
    this.eventBus.addEventListener('objectParamsChanged', this.handleObjectParamsChanged);
  }

  canCreateObject(objectType: string): boolean {
    return this.objectService.isV2ObjectType(objectType);
  }

  async createObject(spec: PatchRuntimeObjectSpec): Promise<void> {
    await this.createOrReplaceObject(spec);
  }

  async updateObject(nodeId: string, spec: PatchRuntimeObjectSpec): Promise<void> {
    const existing = this.objects.get(nodeId);
    const lifecycleKey = this.getObjectLifecycleKey(spec);

    const canSkipUpdate =
      existing && existing.objectType === spec.objectType && existing.lifecycleKey === lifecycleKey;

    if (canSkipUpdate) return;

    await this.createOrReplaceObject(spec);
  }

  destroyObject(nodeId: string): void {
    this.removeObject(nodeId, { bumpRevision: true });
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
      this.nextObjectGeneration(nodeId);
      this.bumpObjectRevision(nodeId);
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

  getObjectRevision(nodeId: string): number {
    return this.objectRevisions.get(nodeId) ?? 0;
  }

  destroy(): void {
    this.eventBus.removeEventListener('objectParamsChanged', this.handleObjectParamsChanged);

    for (const nodeId of [...this.objects.keys()]) {
      this.destroyObject(nodeId);
    }
  }

  private handleObjectParamsChanged = (event: ObjectParamsChangedEvent) => {
    this.onObjectParamsChange?.(event.nodeId, event.params);
    this.bumpObjectRevision(event.nodeId);
  };

  private async createOrReplaceObject(spec: PatchRuntimeObjectSpec): Promise<void> {
    this.removeObject(spec.id, { bumpRevision: false, unregisterMessageNode: false });

    const generation = this.nextObjectGeneration(spec.id);
    const messageContext = new MessageContext(spec.id);
    const lifecycleKey = this.getObjectLifecycleKey(spec);

    this.objects.set(spec.id, {
      objectType: spec.objectType,
      lifecycleKey,
      messageContext,
      generation
    });

    this.objectMessageContexts.set(spec.id, messageContext);

    const object = await this.objectService.createObject(
      spec.id,
      spec.objectType,
      messageContext,
      spec.params,
      spec.rawParams
    );

    if (!this.isCurrentObjectGeneration(spec.id, generation)) {
      return;
    }

    const objectParams = object?.context.getParams() ?? [];

    if (this.hasParamChanges(spec.params, objectParams)) {
      this.onObjectParamsChange?.(spec.id, objectParams);
    }

    this.bumpObjectRevision(spec.id);
  }

  private getObjectLifecycleKey(spec: PatchRuntimeObjectSpec): string {
    return JSON.stringify([spec.objectType, spec.rawParams]);
  }

  private hasParamChanges(currentParams: unknown[], objectParams: unknown[]): boolean {
    return (
      currentParams.length !== objectParams.length ||
      objectParams.some((param, index) => !Object.is(param, currentParams[index]))
    );
  }

  private bumpObjectRevision(nodeId: string): void {
    this.objectRevisions.set(nodeId, (this.objectRevisions.get(nodeId) ?? 0) + 1);
  }

  private nextObjectGeneration(nodeId: string): number {
    const generation = (this.objectGenerations.get(nodeId) ?? 0) + 1;
    this.objectGenerations.set(nodeId, generation);

    return generation;
  }

  private isCurrentObjectGeneration(nodeId: string, generation: number): boolean {
    const record = this.objects.get(nodeId);

    return record?.generation === generation && this.objectGenerations.get(nodeId) === generation;
  }
}
