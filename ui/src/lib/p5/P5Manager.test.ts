import { afterEach, describe, expect, it, vi } from 'vitest';
import { PatchiesEventBus } from '$lib/eventbus/PatchiesEventBus';
import { installInlinePointerCoordinateNormalization, P5Manager } from './P5Manager';

const executeJavaScript = vi.fn();

vi.mock('$lib/canvas/GLSystem', () => ({
  GLSystem: {
    getInstance: () => ({
      hasOutgoingVideoConnections: () => false,
      setBitmapSource: vi.fn()
    })
  }
}));

vi.mock('$lib/js-runner/JSRunner', () => ({
  JSRunner: {
    getInstance: () => ({
      executeJavaScript,
      preprocessCode: vi.fn(),
      destroy: vi.fn()
    })
  }
}));

describe('P5Manager', () => {
  afterEach(() => {
    executeJavaScript.mockReset();
    vi.unstubAllGlobals();
  });

  it('exposes setPrimaryButton to p5 user code', async () => {
    vi.stubGlobal('window', {});

    const events: unknown[] = [];
    const eventBus = PatchiesEventBus.getInstance();
    const listener = (event: unknown) => events.push(event);

    eventBus.addEventListener('nodePrimaryButtonUpdate', listener);

    try {
      executeJavaScript.mockImplementationOnce((_nodeId, _code, options) => {
        options.extraContext.setPrimaryButton('settings');
        return {};
      });

      const manager = new P5Manager('p5-node', {} as HTMLElement);

      await manager['executeUserCode']({} as never, { code: '' }, {});
    } finally {
      eventBus.removeEventListener('nodePrimaryButtonUpdate', listener);
    }

    expect(events).toEqual([
      {
        type: 'nodePrimaryButtonUpdate',
        nodeId: 'p5-node',
        primaryButton: 'settings'
      }
    ]);
  });

  it('exposes setFluidSize to p5 user code', async () => {
    vi.stubGlobal('window', {});

    const setFluidSize = vi.fn();

    executeJavaScript.mockImplementationOnce((_nodeId, _code, options) => {
      options.extraContext.setFluidSize({ keepAspectRatio: true });
      return {};
    });

    const manager = new P5Manager('p5-node', {} as HTMLElement);

    await manager['executeUserCode']({} as never, { code: '', setFluidSize }, {});

    expect(setFluidSize).toHaveBeenCalledWith({ keepAspectRatio: true });
  });

  it('keeps mouse and previous-mouse coordinates in canvas space across scaled pointer events', () => {
    const canvas = {
      scrollWidth: 400,
      scrollHeight: 300,
      getBoundingClientRect: () => ({ width: 800, height: 600 })
    } as HTMLCanvasElement;

    const pointerSketch = {
      _hasMouseInteracted: false,
      mouseX: 0,
      mouseY: 0,
      pmouseX: 0,
      pmouseY: 0,
      canvas,
      _updatePointerCoords(event: PointerEvent) {
        this.mouseX = event.clientX;
        this.mouseY = event.clientY;

        if (!this._hasMouseInteracted) {
          this.pmouseX = this.mouseX;
          this.pmouseY = this.mouseY;
          this._hasMouseInteracted = true;
        }
      }
    };

    installInlinePointerCoordinateNormalization(pointerSketch);

    pointerSketch._updatePointerCoords!({ clientX: 200, clientY: 120 } as PointerEvent);

    expect(pointerSketch).toMatchObject({
      mouseX: 100,
      mouseY: 60,
      pmouseX: 100,
      pmouseY: 60
    });

    // p5 saves the normalized current position at the end of the frame.
    pointerSketch.pmouseX = pointerSketch.mouseX;
    pointerSketch.pmouseY = pointerSketch.mouseY;

    pointerSketch._updatePointerCoords!({ clientX: 300, clientY: 180 } as PointerEvent);

    expect(pointerSketch).toMatchObject({
      mouseX: 150,
      mouseY: 90,
      pmouseX: 100,
      pmouseY: 60
    });
  });
});
