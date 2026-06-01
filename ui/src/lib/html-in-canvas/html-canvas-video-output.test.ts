import { describe, expect, it, vi } from 'vitest';
import {
  configureHtmlCanvasElement,
  captureHtmlCanvasElementImage,
  createHtmlCanvasSupport,
  resolveHtmlCanvasConfig,
  resolveHtmlCanvasSize,
  requestHtmlCanvasPaint,
  syncHtmlCanvasSize
} from './html-canvas-video-output';

function createCanvasStub() {
  const attributes = new Map<string, string>();

  return {
    width: 0,
    height: 0,
    style: { width: '', height: '' },
    setAttribute: vi.fn((name: string, value: string) => {
      attributes.set(name, value);
    }),
    getAttribute: (name: string) => attributes.get(name) ?? null
  } as unknown as HTMLCanvasElement;
}

describe('html-in-canvas DOM video output helpers', () => {
  it('detects support from canvas and 2D context capabilities', () => {
    const support = createHtmlCanvasSupport({
      canvas: { requestPaint: vi.fn(), captureElementImage: vi.fn() },
      context: { drawElementImage: vi.fn() }
    });

    expect(support.supported).toBe(true);
    expect(support.missing).toEqual([]);
  });

  it('reports missing capabilities instead of assuming the flagged API exists', () => {
    const support = createHtmlCanvasSupport({
      canvas: {},
      context: {}
    });

    expect(support.supported).toBe(false);
    expect(support.missing).toEqual([
      'HTMLCanvasElement.requestPaint',
      'HTMLCanvasElement.captureElementImage',
      'CanvasRenderingContext2D.drawElementImage'
    ]);
  });

  it('captures an ElementImage only when captureElementImage is available', () => {
    const element = {} as Element;
    const elementImage = { width: 10, height: 20, close: vi.fn() };
    const canvas = { captureElementImage: vi.fn(() => elementImage) };

    expect(captureHtmlCanvasElementImage(canvas, element)).toBe(elementImage);
    expect(captureHtmlCanvasElementImage({}, element)).toBeNull();
    expect(canvas.captureElementImage).toHaveBeenCalledWith(element);
  });

  it('configures the canvas as a layoutsubtree host with stable sizing', () => {
    const canvas = createCanvasStub();

    configureHtmlCanvasElement(canvas, { width: 640, height: 360, scale: 4 });

    expect(canvas.getAttribute('layoutsubtree')).toBe('');
    expect(canvas.width).toBe(640);
    expect(canvas.height).toBe(360);
    expect(canvas.style.width).toBe('160px');
    expect(canvas.style.height).toBe('90px');
  });

  it('updates canvas dimensions when the output size changes', () => {
    const canvas = createCanvasStub();
    expect(syncHtmlCanvasSize(canvas, { width: 800, height: 600, scale: 2 })).toBe(true);

    expect(canvas.width).toBe(800);
    expect(canvas.height).toBe(600);
    expect(canvas.style.width).toBe('400px');
    expect(canvas.style.height).toBe('300px');
  });

  it('does not rewrite canvas dimensions when the output size is unchanged', () => {
    const canvas = createCanvasStub();
    syncHtmlCanvasSize(canvas, { width: 800, height: 600, scale: 2 });

    expect(syncHtmlCanvasSize(canvas, { width: 800, height: 600, scale: 2 })).toBe(false);
  });

  it('uses measured content size in free mode when no explicit dom size is set', () => {
    expect(
      resolveHtmlCanvasSize({
        mode: 'free',
        measuredWidth: 120,
        measuredHeight: 70,
        outputWidth: 1280,
        outputHeight: 720,
        scale: 4
      })
    ).toEqual({ width: 480, height: 280, scale: 4 });
  });

  it('treats explicit dom size as display size in free mode', () => {
    expect(
      resolveHtmlCanvasSize({
        mode: 'free',
        explicitWidth: 320,
        explicitHeight: 180,
        measuredWidth: 120,
        measuredHeight: 70,
        scale: 4
      })
    ).toEqual({ width: 1280, height: 720, scale: 4 });
  });

  it('uses the render output size by default', () => {
    expect(
      resolveHtmlCanvasSize({
        outputWidth: 1280,
        outputHeight: 720,
        measuredWidth: 120,
        measuredHeight: 70,
        scale: 4
      })
    ).toEqual({ width: 1280, height: 720, scale: 4 });
  });

  it('normalizes htmlCanvas API arguments', () => {
    expect(resolveHtmlCanvasConfig()).toEqual({ enabled: true, mode: 'output' });
    expect(resolveHtmlCanvasConfig(true)).toEqual({ enabled: true, mode: 'output' });
    expect(resolveHtmlCanvasConfig(false)).toEqual({ enabled: false, mode: 'output' });
    expect(resolveHtmlCanvasConfig({ size: 'free' })).toEqual({
      enabled: true,
      mode: 'free'
    });
  });

  it('requests a paint only when the experimental API is present', () => {
    const requestPaint = vi.fn();

    requestHtmlCanvasPaint({ requestPaint });
    requestHtmlCanvasPaint({});

    expect(requestPaint).toHaveBeenCalledOnce();
  });
});
