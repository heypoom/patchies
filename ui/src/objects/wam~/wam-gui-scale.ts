export type WamGuiSize = {
  width: number;
  height: number;
};

const MIN_NODE_WIDTH = 64;
const MIN_NODE_HEIGHT = 128;

export function getWamGuiMinimumSize(naturalSize: WamGuiSize) {
  return {
    width: Math.max(MIN_NODE_WIDTH, Math.ceil(naturalSize.width)),
    height: Math.max(MIN_NODE_HEIGHT, Math.ceil(naturalSize.height))
  };
}

export function getWamGuiScale(naturalSize: WamGuiSize, viewportSize: WamGuiSize) {
  if (
    naturalSize.width <= 0 ||
    naturalSize.height <= 0 ||
    viewportSize.width <= 0 ||
    viewportSize.height <= 0
  ) {
    return { x: 1, y: 1 };
  }

  const scale = Math.min(
    viewportSize.width / naturalSize.width,
    viewportSize.height / naturalSize.height
  );

  return { x: scale, y: scale };
}
