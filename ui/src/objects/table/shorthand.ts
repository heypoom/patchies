import { TABLE_DEFAULT_NODE_DATA } from './constants';

const defaults = TABLE_DEFAULT_NODE_DATA;

export const tableShorthandTransform = (expr: string, name: string) => {
  const parts = expr
    .replace(name, '')
    .trim()
    .split(/\s+/)
    .filter((s) => s.length > 0);

  let bufferName = defaults.bufferName;
  let size = defaults.size;

  if (parts.length === 1) {
    // Could be a name or a size
    const maybeSize = Number(parts[0]);

    if (!isNaN(maybeSize)) {
      size = maybeSize;
    } else {
      bufferName = parts[0];
    }
  } else if (parts.length >= 2) {
    bufferName = parts[0];

    const maybeSize = Number(parts[1]);
    if (!isNaN(maybeSize)) size = maybeSize;
  }

  return { nodeType: 'table', data: { ...defaults, bufferName, size } };
};
