export type PdPortKind = 'message-in' | 'audio-in' | 'message-out' | 'audio-out';

export type PdPort = {
  id: string;
  kind: PdPortKind;
  label: string;
  source: 'abstraction' | 'named';
  index?: number;
  name?: string;
};

type RootObject = { name: string; args: string[]; x: number; order: number };

const INPUT_OBJECTS = new Set(['inlet', 'inlet~']);
const OUTPUT_OBJECTS = new Set(['outlet', 'outlet~']);
const NAMED_INPUT_OBJECTS = new Set(['r', 'receive']);
const NAMED_OUTPUT_OBJECTS = new Set(['s', 'send']);

function parseRecord(record: string): string[] {
  return (record.trim().match(/(?:\\.|[^\s])+/g) ?? []).map((token) =>
    token.replace(/\\ /g, ' ').replace(/\\([,;$])/g, '$1')
  );
}

function rootObjects(source: string): RootObject[] {
  const objects: RootObject[] = [];
  let depth = 0;
  let order = 0;

  for (const record of source.split(';')) {
    const tokens = parseRecord(record);
    if (tokens[0] === '#N' && tokens[1] === 'canvas') {
      depth += 1;
      continue;
    }

    if (tokens[0] === '#X' && tokens[1] === 'restore') {
      depth = Math.max(1, depth - 1);
      continue;
    }

    if (depth !== 1 || tokens[0] !== '#X' || tokens[1] !== 'obj') continue;

    objects.push({
      x: Number(tokens[2]) || 0,
      name: tokens[4] ?? '',
      args: tokens.slice(5),
      order
    });
    order += 1;
  }

  return objects;
}

const byCanvasPosition = (left: RootObject, right: RootObject) =>
  left.x - right.x || left.order - right.order;

function isLiteralName(name: string | undefined): name is string {
  return Boolean(name && !name.includes('$'));
}

export function analyzePdPatch(source: string): PdPort[] {
  const objects = rootObjects(source);
  const inputs = objects.filter((object) => INPUT_OBJECTS.has(object.name)).sort(byCanvasPosition);
  const outputs = objects
    .filter((object) => OUTPUT_OBJECTS.has(object.name))
    .sort(byCanvasPosition);
  const ports: PdPort[] = [];
  const ordinals = new Map<PdPortKind, number>();

  const addAbstractionPorts = (sideObjects: RootObject[], side: 'in' | 'out') => {
    for (const [index, object] of sideObjects.entries()) {
      const audio = object.name.endsWith('~');
      const kind: PdPortKind = `${audio ? 'audio' : 'message'}-${side}`;
      const ordinal = (ordinals.get(kind) ?? 0) + 1;
      ordinals.set(kind, ordinal);
      ports.push({
        id: `abstraction:${side}:${index}`,
        kind,
        label: `${audio ? 'audio' : 'message'} ${side === 'in' ? 'inlet' : 'outlet'} ${ordinal}`,
        source: 'abstraction',
        index
      });
    }
  };

  addAbstractionPorts(inputs, 'in');
  addAbstractionPorts(outputs, 'out');

  const named = new Set<string>();
  for (const object of objects) {
    const side = NAMED_INPUT_OBJECTS.has(object.name)
      ? 'in'
      : NAMED_OUTPUT_OBJECTS.has(object.name)
        ? 'out'
        : null;
    const name = object.args[0];
    if (!side || !isLiteralName(name)) continue;

    const id = `named:${side}:${name}`;
    if (named.has(id)) continue;
    named.add(id);
    ports.push({
      id,
      kind: side === 'in' ? 'message-in' : 'message-out',
      label: name,
      source: 'named',
      name
    });
  }

  return ports;
}

function escapePdAtom(value: string): string {
  return value.replace(/([ ,;$])/g, '\\$1');
}

export function getPdHostReceiver(nodeId: string, port: PdPort): string {
  const safeNodeId = nodeId.replace(/[^a-zA-Z0-9_]/g, '_');
  const safePortId = port.id.replace(/[^a-zA-Z0-9_]/g, '_');

  return `__patchies_${safeNodeId}_${safePortId}`;
}

export function createPdWrapper(options: {
  abstraction: string;
  nodeId: string;
  ports: PdPort[];
  exposedPortIds: string[];
}): string {
  const exposed = options.ports.filter((port) => options.exposedPortIds.includes(port.id));
  const lines = ['#N canvas 0 0 450 300 10;'];
  const connections: string[] = [];
  let objectIndex = 0;

  lines.push(`#X obj 180 120 ${escapePdAtom(options.abstraction)};`);
  const abstractionIndex = objectIndex++;

  const messageInputs = exposed.filter(
    (port) => port.kind === 'message-in' && port.source === 'abstraction'
  );
  for (const port of messageInputs) {
    const receiverIndex = objectIndex++;
    lines.push(
      `#X obj 20 ${30 + receiverIndex * 20} r ${getPdHostReceiver(options.nodeId, port)};`
    );
    connections.push(`#X connect ${receiverIndex} 0 ${abstractionIndex} ${port.index};`);
  }

  const messageOutputs = exposed.filter(
    (port) => port.kind === 'message-out' && port.source === 'abstraction'
  );
  for (const port of messageOutputs) {
    const senderIndex = objectIndex++;
    lines.push(`#X obj 320 ${30 + senderIndex * 20} s ${getPdHostReceiver(options.nodeId, port)};`);
    connections.push(`#X connect ${abstractionIndex} ${port.index} ${senderIndex} 0;`);
  }

  const audioInputs = exposed
    .filter((port) => port.kind === 'audio-in' && port.source === 'abstraction')
    .slice(0, 2);
  if (audioInputs.length > 0) {
    const adcIndex = objectIndex++;
    lines.push('#X obj 20 240 adc~ 1 2;');
    audioInputs.forEach((port, channel) => {
      connections.push(`#X connect ${adcIndex} ${channel} ${abstractionIndex} ${port.index};`);
    });
  }

  const audioOutputs = exposed
    .filter((port) => port.kind === 'audio-out' && port.source === 'abstraction')
    .slice(0, 2);
  if (audioOutputs.length > 0) {
    const dacIndex = objectIndex++;
    lines.push('#X obj 320 240 dac~ 1 2;');
    audioOutputs.forEach((port, channel) => {
      connections.push(`#X connect ${abstractionIndex} ${port.index} ${dacIndex} ${channel};`);
    });
  }

  return [...lines, ...connections, ''].join('\n');
}
