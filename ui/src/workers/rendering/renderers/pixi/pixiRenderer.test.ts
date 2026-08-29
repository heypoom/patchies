import { describe, expect, it, vi } from 'vitest';

import type { RenderParams } from '$lib/rendering/types';

import { PixiRenderer } from './pixiRenderer';

interface TestPixiRenderer {
  renderFrame: PixiRenderer['renderFrame'];
  destroy: PixiRenderer['destroy'];
  pixi: {
    context: { extensions: { loseContext?: { loseContext: ReturnType<typeof vi.fn> } } };
    destroy: ReturnType<typeof vi.fn>;
    render: ReturnType<typeof vi.fn>;
    resetState: ReturnType<typeof vi.fn>;
  } | null;
  stage: { destroy: ReturnType<typeof vi.fn> };
  target: { destroy: ReturnType<typeof vi.fn> } | null;
  draw: ((time: number) => void) | null;
  codeRevision: number;
  config: { code: string; nodeId: string };
  framebuffer: object | null;
  renderer: {
    transportTime: null;
    regl: { _refresh: ReturnType<typeof vi.fn> };
    unregisterSettingsProxy: ReturnType<typeof vi.fn>;
    jsRunner: { destroy: ReturnType<typeof vi.fn> };
  };
  settingsProxy: object | null;
  blitTarget: ReturnType<typeof vi.fn>;
  mouseX: number;
  mouseY: number;
}

const createRenderer = () => Object.create(PixiRenderer.prototype) as TestPixiRenderer;

describe('PixiRenderer', () => {
  it('renders a static stage when user code does not define draw()', () => {
    const render = vi.fn();

    const renderer = createRenderer();
    renderer.stage = { destroy: vi.fn() };
    renderer.target = { destroy: vi.fn() };
    renderer.draw = null;
    renderer.framebuffer = {};
    renderer.blitTarget = vi.fn();

    renderer.renderer = {
      transportTime: null,
      regl: { _refresh: vi.fn() },
      unregisterSettingsProxy: vi.fn(),
      jsRunner: { destroy: vi.fn() }
    };

    renderer.pixi = {
      context: { extensions: {} },
      destroy: vi.fn(),
      render,
      resetState: vi.fn()
    };

    renderer.renderFrame({
      transportTime: 2,
      mouseX: 10,
      mouseY: 20
    } as RenderParams);

    expect(renderer.blitTarget).toHaveBeenCalledTimes(1);

    expect(render).toHaveBeenCalledWith({
      container: renderer.stage,
      target: renderer.target,
      clear: true
    });
  });

  it('flips the pixi render target while blitting it into the regl framebuffer', () => {
    const blitFramebuffer = vi.fn();
    const bindFramebuffer = vi.fn();
    const finishRenderPass = vi.fn();

    const sourceFramebuffer = {} as WebGLFramebuffer;
    const destinationFramebuffer = {} as WebGLFramebuffer;

    const renderer = createRenderer();
    renderer.target = {} as never;

    renderer.framebuffer = {
      _framebuffer: { framebuffer: destinationFramebuffer },
      width: 320,
      height: 180
    };

    renderer.pixi = {
      context: { extensions: {} },
      destroy: vi.fn(),
      render: vi.fn(),
      resetState: vi.fn(),
      renderTarget: {
        finishRenderPass,
        getGpuRenderTarget: vi.fn(() => ({ framebuffer: sourceFramebuffer })),
        getRenderTarget: vi.fn()
      }
    } as never;

    renderer.renderer = {
      transportTime: null,
      regl: { _refresh: vi.fn() },
      unregisterSettingsProxy: vi.fn(),
      jsRunner: { destroy: vi.fn() },
      gl: {
        COLOR_BUFFER_BIT: 0x4000,
        DRAW_FRAMEBUFFER: 0x8ca9,
        FRAMEBUFFER: 0x8d40,
        NEAREST: 0x2600,
        READ_FRAMEBUFFER: 0x8ca8,
        bindFramebuffer,
        blitFramebuffer
      }
    } as never;

    renderer.blitTarget();

    expect(finishRenderPass).toHaveBeenCalledOnce();
    expect(blitFramebuffer).toHaveBeenCalledWith(0, 180, 320, 0, 0, 0, 320, 180, 0x4000, 0x2600);
  });

  it('destroys Pixi resources without losing the shared WebGL context', () => {
    const renderer = createRenderer();

    const loseContext = vi.fn();
    const settingsProxy = {};

    const pixi = {
      context: { extensions: { loseContext: { loseContext } } },
      render: vi.fn(),
      resetState: vi.fn(),
      destroy: vi.fn(() => pixi.context.extensions.loseContext?.loseContext())
    };

    renderer.pixi = pixi;
    renderer.stage = { destroy: vi.fn() };
    renderer.target = { destroy: vi.fn() };
    renderer.draw = null;
    renderer.codeRevision = 1;
    renderer.config = { code: '', nodeId: 'pixi-node' };
    renderer.framebuffer = {};
    renderer.settingsProxy = settingsProxy;
    renderer.blitTarget = vi.fn();

    renderer.renderer = {
      transportTime: null,
      regl: { _refresh: vi.fn() },
      unregisterSettingsProxy: vi.fn(),
      jsRunner: { destroy: vi.fn() }
    };

    renderer.destroy();

    expect(pixi.destroy).toHaveBeenCalledTimes(1);
    expect(loseContext).not.toHaveBeenCalled();
    expect(renderer.renderer.jsRunner.destroy).toHaveBeenCalledWith('pixi-node');
    expect(renderer.codeRevision).toBe(2);

    expect(renderer.renderer.unregisterSettingsProxy).toHaveBeenCalledWith(
      'pixi-node',
      settingsProxy
    );
  });
});
