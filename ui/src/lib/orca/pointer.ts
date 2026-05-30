type OrcaGridPointerRect = Pick<DOMRect, 'left' | 'top'>;

type ScreenToOrcaGridCellOptions = {
  clientX: number;
  clientY: number;
  rect: OrcaGridPointerRect;
  zoom: number;
  tileWidth: number;
  tileHeight: number;
};

export function screenToOrcaGridCell({
  clientX,
  clientY,
  rect,
  zoom,
  tileWidth,
  tileHeight
}: ScreenToOrcaGridCellOptions): { x: number; y: number } {
  const scale = zoom || 1;
  const canvasX = (clientX - rect.left) / scale;
  const canvasY = (clientY - rect.top) / scale;

  return {
    x: Math.floor(canvasX / tileWidth),
    y: Math.floor(canvasY / tileHeight)
  };
}
