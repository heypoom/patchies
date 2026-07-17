type NodeData = Record<string, unknown>;

export const hasParamChanges = (currentParams: unknown[], nextParams: unknown[]): boolean =>
  currentParams.length !== nextParams.length ||
  nextParams.some((param, index) => !Object.is(param, currentParams[index]));

export function diffNodeData(current: NodeData, next: NodeData): NodeData {
  const updates: NodeData = {};

  for (const [key, value] of Object.entries(next)) {
    if (!Object.is(current[key], value)) {
      updates[key] = value;
    }
  }

  return updates;
}
