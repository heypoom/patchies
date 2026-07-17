import type {
  RuntimeConnectionSpec,
  RuntimeGraphSpec,
  RuntimeObjectSpec
} from '../types/runtime-object';

import { getRuntimeConnectionId } from '../utils/runtime-object-keys';

export class PatchGraph {
  private objectsById = new Map<string, RuntimeObjectSpec>();
  private connectionsById = new Map<string, RuntimeConnectionSpec & { id: string }>();

  setGraph(graph: RuntimeGraphSpec): { connectionsChanged: boolean } {
    this.objectsById = new Map(graph.objects.map((object) => [object.id, object]));

    const connectionsChanged = this.setConnections(graph.connections ?? []);

    return { connectionsChanged };
  }

  setObjects(objects: RuntimeObjectSpec[]): void {
    this.objectsById = new Map(objects.map((object) => [object.id, object]));
  }

  getGraph(): RuntimeGraphSpec {
    return { objects: this.getObjects(), connections: this.getConnections() };
  }

  getObjects(): RuntimeObjectSpec[] {
    return Array.from(this.objectsById.values());
  }

  getConnections(): Array<RuntimeConnectionSpec & { id: string }> {
    return Array.from(this.connectionsById.values());
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

  upsertObject(object: RuntimeObjectSpec): void {
    this.objectsById.set(object.id, object);
  }

  removeObject(nodeId: string): void {
    this.objectsById.delete(nodeId);

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

const normalizeConnection = (
  connection: RuntimeConnectionSpec
): RuntimeConnectionSpec & { id: string } => ({
  ...connection,
  id: connection.id ?? getRuntimeConnectionId(connection)
});

const areConnectionMapsEqual = (
  left: Map<string, RuntimeConnectionSpec & { id: string }>,
  right: Map<string, RuntimeConnectionSpec & { id: string }>
): boolean => {
  if (left.size !== right.size) return false;

  for (const [id, connection] of left) {
    const nextConnection = right.get(id);
    if (!nextConnection) return false;
    if (getConnectionKey(connection) !== getConnectionKey(nextConnection)) return false;
  }

  return true;
};

const getConnectionKey = (connection: RuntimeConnectionSpec & { id: string }): string =>
  `${connection.id}:${getRuntimeConnectionId(connection)}`;
