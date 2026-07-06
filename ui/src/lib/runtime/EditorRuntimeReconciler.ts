import type { Node } from '@xyflow/svelte';
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

export type EditorRuntime = {
  canCreateObject(objectType: string): boolean;
  createObject(spec: PatchRuntimeObjectSpec): Promise<void>;
  updateObject(nodeId: string, spec: PatchRuntimeObjectSpec): Promise<void>;
  destroyObject(nodeId: string): void;
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

  constructor(private runtime: EditorRuntime) {}

  async reconcile(nodes: Node[]): Promise<void> {
    const desiredObjectSpecs = new Map<string, PatchRuntimeObjectSpec>();
    const pendingRuntimeUpdates: Promise<void>[] = [];

    for (const node of nodes) {
      const spec = this.getRuntimeObjectSpec(node);
      if (!spec) continue;

      desiredObjectSpecs.set(spec.id, spec);
    }

    this.next.ids = new Set(desiredObjectSpecs.keys());

    this.next.specKeys = new Map(
      [...desiredObjectSpecs].map(([nodeId, spec]) => [nodeId, this.getRuntimeObjectSpecKey(spec)])
    );

    const trackedRuntimeObjectIds = new Set([...this.current.ids, ...this.next.pendingIds]);

    for (const nodeId of trackedRuntimeObjectIds) {
      if (!desiredObjectSpecs.has(nodeId)) {
        this.runtime.destroyObject(nodeId);
        this.current.ids.delete(nodeId);
        this.current.specKeys.delete(nodeId);

        this.next.pendingIds.delete(nodeId);
      }
    }

    for (const spec of desiredObjectSpecs.values()) {
      if (this.next.pendingIds.has(spec.id)) continue;

      const specKey = this.getRuntimeObjectSpecKey(spec);
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
    if (node.type !== 'object') return null;

    const data = node.data as EditorRuntimeObjectData | undefined;

    const objectType = typeof data?.name === 'string' ? data.name : '';
    if (!objectType || !this.runtime.canCreateObject(objectType)) return null;

    const rawParams = this.getRawParams(data?.expr);
    const expectedParams = parseObjectParamFromString(objectType, rawParams);
    const savedParams = Array.isArray(data?.params) ? data.params : [];
    const params = savedParams.length === expectedParams.length ? savedParams : expectedParams;

    return { id: node.id, objectType, params, rawParams };
  }

  private getRawParams(expr: unknown): string[] {
    if (typeof expr !== 'string') return [];

    const trimmed = expr.trim();
    if (!trimmed) return [];

    return trimmed.split(/\s+/).slice(1);
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

  private getRuntimeObjectSpecKey(spec: PatchRuntimeObjectSpec): string {
    return JSON.stringify([spec.objectType, spec.params, spec.rawParams]);
  }
}
