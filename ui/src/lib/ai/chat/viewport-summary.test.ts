import { describe, expect, test } from 'vitest';

import { buildChatViewportSummary } from './viewport-summary';

describe('buildChatViewportSummary', () => {
  test('builds viewport center and bounds from the canvas screen rect', () => {
    const summary = buildChatViewportSummary({
      viewport: { x: -50, y: -20, zoom: 2 },
      screenRect: { x: 100, y: 50, width: 400, height: 200 },
      fallbackScreen: { width: 999, height: 999 },
      screenToFlowPosition: ({ x, y }) => ({ x: (x + 50) / 2, y: (y + 20) / 2 })
    });

    expect(summary).toEqual({
      viewport: { x: -50, y: -20, zoom: 2 },
      center: { x: 175, y: 85 },
      bounds: {
        left: 75,
        top: 35,
        right: 275,
        bottom: 135,
        width: 200,
        height: 100
      },
      screen: { x: 100, y: 50, width: 400, height: 200 }
    });
  });

  test('falls back to the window-sized screen when no rect is available', () => {
    const summary = buildChatViewportSummary({
      viewport: { x: 0, y: 0, zoom: 1 },
      fallbackScreen: { width: 800, height: 600 },
      screenToFlowPosition: (position) => position
    });

    expect(summary.screen).toEqual({ x: 0, y: 0, width: 800, height: 600 });
    expect(summary.center).toEqual({ x: 400, y: 300 });
  });
});
