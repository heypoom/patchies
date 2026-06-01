export type OrcaSelection = {
  x: number;
  y: number;
  w: number;
  h: number;
};

export type OrcaSelectionBounds = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
};

export function getOrcaSelectionBounds(selection: OrcaSelection): OrcaSelectionBounds {
  const endX = selection.x + selection.w;
  const endY = selection.y + selection.h;
  const minX = Math.min(selection.x, endX);
  const minY = Math.min(selection.y, endY);
  const maxX = Math.max(selection.x, endX);
  const maxY = Math.max(selection.y, endY);

  return {
    minX,
    minY,
    maxX,
    maxY,
    width: maxX - minX + 1,
    height: maxY - minY + 1
  };
}

export function fillOrcaSelection(
  selection: OrcaSelection,
  glyph: string,
  write: (x: number, y: number, glyph: string) => void
): void {
  const { minX, minY, maxX, maxY } = getOrcaSelectionBounds(selection);

  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      write(x, y, glyph);
    }
  }
}
