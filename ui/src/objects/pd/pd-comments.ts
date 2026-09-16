type CanvasState = {
  disabledItems: Set<number>;
  nextItemIndex: number;
};

type ProcessedLine = {
  canvas?: CanvasState;
  connection?: { from: number; to: number };
  text: string;
};

const PATCHIES_COMMENT = /^(\s*)\/\/\s?(.*)$/;
const PD_RECORD = /^(#[NXA])\s+([^\s;]+)(.*);\s*$/;
const PD_CONNECTION = /^\s*(-?\d+)\s+\d+\s+(-?\d+)\s+\d+\s*$/;

const coordinates = (rest: string): [string, string] => {
  const atoms = rest.trim().split(/\s+/);

  return [
    /^-?\d+$/.test(atoms[0] ?? '') ? atoms[0] : '0',
    /^-?\d+$/.test(atoms[1] ?? '') ? atoms[1] : '0'
  ];
};

/**
 * Turns Patchies-only `//` lines into valid Pd records before loading.
 *
 * Pd connections address canvas items by ordinal. Disabled items therefore
 * become inert text records instead of being removed, and their connections
 * are omitted for this load. The editor source remains unchanged so toggling
 * the comment off restores both the item and its wiring.
 */
export function compilePdComments(source: string): string {
  const canvases: CanvasState[] = [];
  const processed: ProcessedLine[] = [];

  for (const [lineIndex, line] of source.split('\n').entries()) {
    const comment = line.match(PATCHIES_COMMENT);
    const disabled = comment !== null;
    const recordText = disabled ? comment[2].trim() : line.trim();
    const record = recordText.match(PD_RECORD);

    if (!record) {
      processed.push({ text: disabled ? '' : line });
      continue;
    }

    const [, directive, selector, rest] = record;

    if (directive === '#N' && selector === 'canvas') {
      if (disabled) {
        throw new Error(`Pd canvas records cannot be commented out (line ${lineIndex + 1}).`);
      }

      canvases.push({ disabledItems: new Set(), nextItemIndex: 0 });
      processed.push({ text: line });
      continue;
    }

    if (directive === '#X' && selector === 'restore') {
      if (disabled) {
        throw new Error(`Pd restore records cannot be commented out (line ${lineIndex + 1}).`);
      }

      if (canvases.length > 1) canvases.pop();

      const parent = canvases.at(-1);
      if (parent) parent.nextItemIndex += 1;
      processed.push({ text: line });
      continue;
    }

    const canvas = canvases.at(-1);
    if (directive !== '#X' || !canvas) {
      processed.push({ text: disabled ? '' : line });
      continue;
    }

    if (selector === 'connect') {
      const connection = rest.match(PD_CONNECTION);
      processed.push({
        canvas,
        connection: connection
          ? { from: Number(connection[1]), to: Number(connection[2]) }
          : undefined,
        text: disabled ? '' : line
      });
      continue;
    }

    if (selector === 'coords') {
      processed.push({ text: disabled ? '' : line });
      continue;
    }

    const itemIndex = canvas.nextItemIndex;
    canvas.nextItemIndex += 1;

    if (!disabled) {
      processed.push({ text: line });
      continue;
    }

    canvas.disabledItems.add(itemIndex);
    const [x, y] = coordinates(rest);
    processed.push({ text: `#X text ${x} ${y} Patchies disabled;` });
  }

  return processed
    .map(({ canvas, connection, text }) => {
      if (
        canvas &&
        connection &&
        (canvas.disabledItems.has(connection.from) || canvas.disabledItems.has(connection.to))
      ) {
        return '';
      }

      return text;
    })
    .join('\n');
}
