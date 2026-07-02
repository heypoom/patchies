import { afterEach, describe, expect, it, vi } from 'vitest';
import { PatchiesEventBus } from '$lib/eventbus/PatchiesEventBus';
import { P5Manager } from './P5Manager';

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
});
