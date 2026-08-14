import type {
  RuntimeConnectionSpec,
  RuntimeGraphSpec,
  RuntimeObjectSpec
} from '../types/runtime-object';

import { normalizeConnection, getChangedConnectionNodeIds } from '../utils/patch-graph-utils';

import { getObjectKey } from '../utils/runtime-object-keys';

export class PatchGraph {
  private objectsById = new Map<string, RuntimeObjectSpec>();
  private objectKeysById = new Map<string, string>();
  private connectionsById = new Map<string, RuntimeConnectionSpec & { id: string }>();

  getGraph(): RuntimeGraphSpec {
    return { objects: this.getObjects(), connections: this.getConnections() };
  }

  getObjects(): RuntimeObjectSpec[] {
    return Array.from(this.objectsById.values());
  }

  getConnections(): Array<RuntimeConnectionSpec & { id: string }> {
    return Array.from(this.connectionsById.values());
  }

  setObjects(objects: RuntimeObjectSpec[]): { changed: boolean; changedObjectIds: Set<string> } {
    const nextObjectsById = new Map(objects.map((object) => [object.id, object]));
    const nextObjectKeysById = new Map(objects.map((object) => [object.id, getObjectKey(object)]));
    const changedObjectIds = getChangedKeys(this.objectKeysById, nextObjectKeysById);

    this.objectsById = nextObjectsById;
    this.objectKeysById = nextObjectKeysById;

    return { changed: changedObjectIds.size > 0, changedObjectIds };
  }

  setConnections(connections: RuntimeConnectionSpec[]): {
    changed: boolean;
    changedConnectionNodeIds: Set<string>;
  } {
    const nextConnectionsById = new Map(
      connections.map((connection) => {
        const normalized = normalizeConnection(connection);

        return [normalized.id, normalized];
      })
    );

    const changedConnectionNodeIds = getChangedConnectionNodeIds(
      this.connectionsById,
      nextConnectionsById
    );

    this.connectionsById = nextConnectionsById;

    return {
      changedConnectionNodeIds,
      changed: changedConnectionNodeIds.size > 0
    };
  }

  setGraph(graph: RuntimeGraphSpec): {
    objectsChanged: boolean;
    connectionsChanged: boolean;
    changedObjectIds: Set<string>;
    changedConnectionNodeIds: Set<string>;
  } {
    const objectUpdate = this.setObjects(graph.objects);
    const connectionUpdate = this.setConnections(graph.connections ?? []);

    return {
      objectsChanged: objectUpdate.changed,
      connectionsChanged: connectionUpdate.changed,
      changedObjectIds: objectUpdate.changedObjectIds,
      changedConnectionNodeIds: connectionUpdate.changedConnectionNodeIds
    };
  }

  upsertObject(object: RuntimeObjectSpec): void {
    this.objectsById.set(object.id, object);
    this.objectKeysById.set(object.id, getObjectKey(object));
  }

  removeObject(nodeId: string): void {
    this.objectsById.delete(nodeId);
    this.objectKeysById.delete(nodeId);

    for (const [connectionId, connection] of this.connectionsById) {
      if (connection.source === nodeId || connection.target === nodeId) {
        this.connectionsById.delete(connectionId);
      }
    }
  }

  upsertConnection(connection: RuntimeConnectionSpec): string {
    const normalized = normalizeConnection(connection);
    this.connectionsById.set(normalized.id, normalized);

    return normalized.id;
  }

  removeConnection(connectionId: string): void {
    this.connectionsById.delete(connectionId);
  }
}

function getChangedKeys(left: Map<string, string>, right: Map<string, string>): Set<string> {
  const changedKeys = new Set<string>();

  for (const [key, value] of left) {
    if (right.get(key) !== value) {
      changedKeys.add(key);
    }
  }

  for (const [key, value] of right) {
    if (left.get(key) !== value) {
      changedKeys.add(key);
    }
  }

  return changedKeys;
}
