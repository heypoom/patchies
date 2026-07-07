import type { Edge, Node } from '@xyflow/svelte';
import { hash } from 'ohash';
import { AudioRegistry } from '$lib/registry/AudioRegistry';
import type { ObjectInlet } from '$lib/objects/v2/object-metadata';
import { parseObjectParamFromString } from '$lib/objects/parse-object-param';
import { logger } from '$lib/utils/logger';
import type { PatchRuntimeObjectSpec } from './PatchRuntime';

interface EditorRuntimeObjectData {
  expr?: unknown;
  name?: unknown;
  params?: unknown;
}

interface RuntimeObjectSnapshot {
  ids: Set<string>;
  specKeys: Map<string, string>;
}

type NextRuntimeObjectSnapshot = RuntimeObjectSnapshot & { pendingIds: Set<string> };

type DedicatedAudioObjectSpec = {
  id: string;
  objectType: string;
  params: unknown[];
  edges: Edge[];
};

export type EditorRuntime = {
  isObjectInRegistry(objectType: string): boolean;
  createObject(spec: PatchRuntimeObjectSpec): Promise<void>;
  updateObject(nodeId: string, spec: PatchRuntimeObjectSpec): Promise<void>;
  destroyObject(nodeId: string): void;
  canCreateAudioObject?(objectType: string): boolean;
  syncAudioObject?(spec: DedicatedAudioObjectSpec): boolean;
  destroyAudioObject?(nodeId: string): void;
};

export class EditorRuntimeReconciler {
  private current: RuntimeObjectSnapshot = {
    ids: new Set(),
    specKeys: new Map()
  };

  private next: NextRuntimeObjectSnapshot = {
    ids: new Set(),
    specKeys: new Map(),
    pendingIds: new Set()
  };

  private currentAudioIds = new Set<string>();

  constructor(private runtime: EditorRuntime) {}

  async reconcile(nodes: Node[], edges: Edge[] = []): Promise<void> {
    const nextObjectSpecs = new Map<string, PatchRuntimeObjectSpec>();
    const nextAudioSpecs = new Map<string, DedicatedAudioObjectSpec>();
    const pendingRuntimeUpdates: Promise<void>[] = [];

    for (const node of nodes) {
      const audioSpec = this.getDedicatedAudioObjectSpec(node, edges);
      if (audioSpec) {
        nextAudioSpecs.set(audioSpec.id, audioSpec);
        continue;
      }

      const spec = this.getRuntimeObjectSpec(node);
      if (!spec) continue;

      nextObjectSpecs.set(spec.id, spec);
    }

    this.next.ids = new Set(nextObjectSpecs.keys());

    this.next.specKeys = new Map(
      [...nextObjectSpecs].map(([nodeId, spec]) => [nodeId, getRuntimeObjectSpecKey(spec)])
    );

    const trackedRuntimeObjectIds = new Set([...this.current.ids, ...this.next.pendingIds]);

    for (const nodeId of trackedRuntimeObjectIds) {
      if (!nextObjectSpecs.has(nodeId)) {
        this.runtime.destroyObject(nodeId);
        this.current.ids.delete(nodeId);
        this.current.specKeys.delete(nodeId);

        this.next.pendingIds.delete(nodeId);
      }
    }

    this.syncDedicatedAudioObjects(nextAudioSpecs);

    for (const spec of nextObjectSpecs.values()) {
      if (this.next.pendingIds.has(spec.id)) continue;

      const specKey = getRuntimeObjectSpecKey(spec);
      const hasCommittedObject = this.current.ids.has(spec.id);
      const lastSyncedSpecKey = this.current.specKeys.get(spec.id);

      if (hasCommittedObject && lastSyncedSpecKey === specKey) continue;

      const operation = () =>
        hasCommittedObject
          ? this.runtime.updateObject(spec.id, spec)
          : this.runtime.createObject(spec);

      pendingRuntimeUpdates.push(this.syncRuntimeObject(spec, specKey, operation));
    }

    await Promise.all(pendingRuntimeUpdates);
  }

  private getRuntimeObjectSpec(node: Node): PatchRuntimeObjectSpec | null {
    const objectType = getRuntimeObjectType(node);
    if (!objectType || !this.runtime.isObjectInRegistry(objectType)) return null;

    const data = node.data as EditorRuntimeObjectData | undefined;

    return getRuntimeObjectSpecFromNode(node.id, objectType, data);
  }

  private getDedicatedAudioObjectSpec(node: Node, edges: Edge[]): DedicatedAudioObjectSpec | null {
    if (node.type === 'object') return null;

    const objectType = getRuntimeObjectType(node);
    if (!objectType || !this.runtime.canCreateAudioObject?.(objectType)) return null;

    const nodeClass = AudioRegistry.getInstance().get(objectType);
    if (!nodeClass) return null;
    if (!nodeClass.runtimeManaged) return null;

    return {
      id: node.id,
      objectType,
      params: getAudioParamsFromNodeData(nodeClass.inlets ?? [], node.data),
      edges
    };
  }

  private syncDedicatedAudioObjects(nextAudioSpecs: Map<string, DedicatedAudioObjectSpec>): void {
    const nextAudioIds = new Set(nextAudioSpecs.keys());

    for (const nodeId of this.currentAudioIds) {
      if (!nextAudioIds.has(nodeId)) {
        this.runtime.destroyAudioObject?.(nodeId);
        this.currentAudioIds.delete(nodeId);
      }
    }

    for (const spec of nextAudioSpecs.values()) {
      this.runtime.syncAudioObject?.(spec);
      this.currentAudioIds.add(spec.id);
    }
  }

  private async syncRuntimeObject(
    spec: PatchRuntimeObjectSpec,
    specKey: string,
    operation: () => Promise<void>
  ): Promise<void> {
    this.next.pendingIds.add(spec.id);

    try {
      await operation();

      if (this.next.specKeys.get(spec.id) !== specKey) return;

      this.current.ids.add(spec.id);
      this.current.specKeys.set(spec.id, specKey);
    } catch (error) {
      logger.warn(`failed to sync runtime object "${spec.id}"`, error);
    } finally {
      this.next.pendingIds.delete(spec.id);
    }
  }
}

const getRuntimeObjectSpecKey = (spec: PatchRuntimeObjectSpec): string =>
  hash([spec.objectType, spec.params, spec.rawParams]);

function getRuntimeObjectType(node: Node): string {
  if (node.type !== 'object') return node.type ?? '';

  const data = node.data as EditorRuntimeObjectData | undefined;

  return typeof data?.name === 'string' ? data.name : '';
}

function getRuntimeObjectSpecFromNode(
  nodeId: string,
  objectType: string,
  data?: EditorRuntimeObjectData
) {
  const rawParams = getRawObjectParamsFromExpr(data?.expr);
  const expectedParams = parseObjectParamFromString(objectType, rawParams);
  const savedParams = Array.isArray(data?.params) ? data.params : [];
  const params = savedParams.length === expectedParams.length ? savedParams : expectedParams;

  return { id: nodeId, objectType, params, rawParams };
}

function getRawObjectParamsFromExpr(expr: unknown): string[] {
  if (typeof expr !== 'string') return [];

  const trimmed = expr.trim();
  if (!trimmed) return [];

  return trimmed.split(/\s+/).slice(1);
}

function getAudioParamsFromNodeData(
  inlets: ObjectInlet[],
  data: Record<string, unknown> | undefined
): unknown[] {
  return inlets.map((inlet) => {
    if (inlet.type === 'signal' && !inlet.acceptsFloat && !inlet.messages?.length) {
      return null;
    }

    if (inlet.name && data && data[inlet.name] !== undefined) {
      return data[inlet.name];
    }

    return inlet.defaultValue ?? null;
  });
}
