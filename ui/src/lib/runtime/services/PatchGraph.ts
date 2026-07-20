import type {
  RuntimeConnectionSpec,
  RuntimeGraphSpec,
  RuntimeObjectSpec
} from '../types/runtime-object';

import {
  areStringMapsEqual,
  normalizeConnection,
  areConnectionMapsEqual
} from '../utils/patch-graph-utils';

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

  setObjects(objects: RuntimeObjectSpec[]): boolean {
    const nextObjectsById = new Map(objects.map((object) => [object.id, object]));
    const nextObjectKeysById = new Map(objects.map((object) => [object.id, getObjectKey(object)]));

    const objectsChanged = !areStringMapsEqual(this.objectKeysById, nextObjectKeysById);

    this.objectsById = nextObjectsById;
    this.objectKeysById = nextObjectKeysById;

    return objectsChanged;
  }

  setConnections(connections: RuntimeConnectionSpec[]): boolean {
    const nextConnectionsById = new Map(
      connections.map((connection) => {
        const normalized = normalizeConnection(connection);

        return [normalized.id, normalized];
      })
    );

    const connectionsChanged = !areConnectionMapsEqual(this.connectionsById, nextConnectionsById);
    this.connectionsById = nextConnectionsById;

    return connectionsChanged;
  }

  setGraph(graph: RuntimeGraphSpec): { objectsChanged: boolean; connectionsChanged: boolean } {
    const objectsChanged = this.setObjects(graph.objects);
    const connectionsChanged = this.setConnections(graph.connections ?? []);

    return { objectsChanged, connectionsChanged };
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
