export interface Wire {
  source: string;
  sourceHandle: string | null;
  target: string;
  targetHandle: string | null;
}

const identifier = '(?:"(?:[^"\\\\]|\\\\.)*"|[^\\s:"#]+)';
const linePattern = new RegExp(
  `^(${identifier}):(${identifier})\\s*->\\s*(${identifier}):(${identifier})$`
);
const decode = (value: string): string => (value.startsWith('"') ? JSON.parse(value) : value);
const handle = (value: string): string | null => (value === '@default' ? null : decode(value));
const encode = (value: string): string =>
  /^[^\s:"#]+$/.test(value) && value !== '@default' && !value.includes('->')
    ? value
    : JSON.stringify(value);
const encodeHandle = (value: string | null): string =>
  value === null ? '@default' : encode(value);
export const wireKey = (wire: Wire): string =>
  JSON.stringify([wire.source, wire.sourceHandle, wire.target, wire.targetHandle]);

export function parseConnections(content: string): Wire[] {
  const wires = new Map<string, Wire>();

  for (const [index, line] of content.split(/\r?\n/).entries()) {
    const text = line.trim();
    if (!text || text.startsWith('#')) continue;

    try {
      const match = text.match(linePattern);
      if (!match) throw new Error('expected source:handle -> target:handle');

      const wire = {
        source: decode(match[1]),
        sourceHandle: handle(match[2]),
        target: decode(match[3]),
        targetHandle: handle(match[4])
      };
      if (!wire.source || !wire.target || wire.sourceHandle === '' || wire.targetHandle === '')
        throw new Error('endpoint IDs cannot be empty');

      wires.set(wireKey(wire), wire);
    } catch (error) {
      throw new Error(
        `Line ${index + 1}: ${error instanceof Error ? error.message : 'invalid connection'}`
      );
    }
  }

  return [...wires.values()];
}

export const serializeConnections = (wires: Wire[]): string =>
  [
    ...new Set(
      wires.map(
        (wire) =>
          `${encode(wire.source)}:${encodeHandle(wire.sourceHandle)} -> ${encode(wire.target)}:${encodeHandle(wire.targetHandle)}`
      )
    )
  ]
    .sort()
    .join('\n') + (wires.length ? '\n' : '');

export function connectionDelta(
  baseline: string,
  content: string
): { add: Wire[]; remove: Wire[] } {
  const before = new Map(parseConnections(baseline).map((wire) => [wireKey(wire), wire]));
  const after = new Map(parseConnections(content).map((wire) => [wireKey(wire), wire]));

  return {
    add: [...after].filter(([key]) => !before.has(key)).map(([, wire]) => wire),
    remove: [...before].filter(([key]) => !after.has(key)).map(([, wire]) => wire)
  };
}
