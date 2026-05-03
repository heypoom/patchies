export interface ChatViewportSummary {
  viewport: { x: number; y: number; zoom: number };
  center: { x: number; y: number };
  bounds: {
    left: number;
    top: number;
    right: number;
    bottom: number;
    width: number;
    height: number;
  };
  screen: { x: number; y: number; width: number; height: number };
}

interface ScreenRect {
  x?: number;
  y?: number;
  left?: number;
  top?: number;
  width: number;
  height: number;
}

interface BuildChatViewportSummaryArgs {
  viewport: ChatViewportSummary['viewport'];
  screenRect?: ScreenRect | null;
  fallbackScreen: { width: number; height: number };
  screenToFlowPosition: (position: { x: number; y: number }) => { x: number; y: number };
}

export function buildChatViewportSummary({
  viewport,
  screenRect,
  fallbackScreen,
  screenToFlowPosition
}: BuildChatViewportSummaryArgs): ChatViewportSummary {
  const screen = {
    x: screenRect?.x ?? screenRect?.left ?? 0,
    y: screenRect?.y ?? screenRect?.top ?? 0,
    width: screenRect?.width ?? fallbackScreen.width,
    height: screenRect?.height ?? fallbackScreen.height
  };

  const topLeft = screenToFlowPosition({ x: screen.x, y: screen.y });
  const bottomRight = screenToFlowPosition({
    x: screen.x + screen.width,
    y: screen.y + screen.height
  });
  const center = screenToFlowPosition({
    x: screen.x + screen.width / 2,
    y: screen.y + screen.height / 2
  });

  const left = Math.min(topLeft.x, bottomRight.x);
  const top = Math.min(topLeft.y, bottomRight.y);
  const right = Math.max(topLeft.x, bottomRight.x);
  const bottom = Math.max(topLeft.y, bottomRight.y);

  return {
    viewport,
    center,
    bounds: {
      left,
      top,
      right,
      bottom,
      width: right - left,
      height: bottom - top
    },
    screen
  };
}
