import { getConnectionKey, getRuntimeConnectionId } from './runtime-object-keys';

import type { RuntimeConnectionSpec } from '../types/runtime-object';

export const normalizeConnection = (
  connection: RuntimeConnectionSpec
): RuntimeConnectionSpec & { id: string } => ({
  ...connection,
  id: connection.id ?? getRuntimeConnectionId(connection)
});

export const areConnectionMapsEqual = (
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

export const getChangedConnectionNodeIds = (
  left: Map<string, RuntimeConnectionSpec & { id: string }>,
  right: Map<string, RuntimeConnectionSpec & { id: string }>
): Set<string> => {
  const changedNodeIds = new Set<string>();

  for (const [id, connection] of left) {
    const nextConnection = right.get(id);

    if (!nextConnection || getConnectionKey(connection) !== getConnectionKey(nextConnection)) {
      changedNodeIds.add(connection.source);
      changedNodeIds.add(connection.target);
    }
  }

  for (const [id, connection] of right) {
    const previousConnection = left.get(id);

    if (
      !previousConnection ||
      getConnectionKey(previousConnection) !== getConnectionKey(connection)
    ) {
      changedNodeIds.add(connection.source);
      changedNodeIds.add(connection.target);
    }
  }

  return changedNodeIds;
};

export const areStringMapsEqual = (
  left: Map<string, string>,
  right: Map<string, string>
): boolean => {
  if (left.size !== right.size) return false;

  for (const [id, value] of left) {
    if (right.get(id) !== value) return false;
  }

  return true;
};
