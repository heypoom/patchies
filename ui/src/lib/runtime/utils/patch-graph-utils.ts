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
