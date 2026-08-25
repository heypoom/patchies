import { describe, expect, it, vi } from 'vitest';
import type { RenderParams } from '$lib/rendering/types';
import { PixiRenderer } from './pixiRenderer';

type TestPixiRenderer = {
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
};

const createRenderer = () => Object.create(PixiRenderer.prototype) as TestPixiRenderer;

describe('PixiRenderer', () => {
  it('renders a static stage when user code does not define draw()', () => {
    const renderer = createRenderer();
    const render = vi.fn();

    renderer.pixi = {
      context: { extensions: {} },
      destroy: vi.fn(),
      render,
      resetState: vi.fn()
    };
    renderer.stage = { destroy: vi.fn() };
    renderer.target = { destroy: vi.fn() };
    renderer.draw = null;
    renderer.framebuffer = {};
    renderer.renderer = {
      transportTime: null,
      regl: { _refresh: vi.fn() },
      unregisterSettingsProxy: vi.fn(),
      jsRunner: { destroy: vi.fn() }
    };
    renderer.blitTarget = vi.fn();

    renderer.renderFrame({ transportTime: 2, mouseX: 10, mouseY: 20 } as RenderParams);

    expect(render).toHaveBeenCalledWith({
      container: renderer.stage,
      target: renderer.target,
      clear: true
    });
    expect(renderer.blitTarget).toHaveBeenCalledTimes(1);
  });

  it('destroys Pixi resources without losing the shared WebGL context', () => {
    const renderer = createRenderer();
    const loseContext = vi.fn();
    const pixi = {
      context: { extensions: { loseContext: { loseContext } } },
      render: vi.fn(),
      resetState: vi.fn(),
      destroy: vi.fn(() => pixi.context.extensions.loseContext?.loseContext())
    };
    const settingsProxy = {};

    renderer.pixi = pixi;
    renderer.stage = { destroy: vi.fn() };
    renderer.target = { destroy: vi.fn() };
    renderer.draw = null;
    renderer.codeRevision = 1;
    renderer.config = { code: '', nodeId: 'pixi-node' };
    renderer.framebuffer = {};
    renderer.settingsProxy = settingsProxy;
    renderer.renderer = {
      transportTime: null,
      regl: { _refresh: vi.fn() },
      unregisterSettingsProxy: vi.fn(),
      jsRunner: { destroy: vi.fn() }
    };
    renderer.blitTarget = vi.fn();

    renderer.destroy();

    expect(pixi.destroy).toHaveBeenCalledTimes(1);
    expect(loseContext).not.toHaveBeenCalled();
    expect(renderer.renderer.unregisterSettingsProxy).toHaveBeenCalledWith(
      'pixi-node',
      settingsProxy
    );
    expect(renderer.renderer.jsRunner.destroy).toHaveBeenCalledWith('pixi-node');
    expect(renderer.codeRevision).toBe(2);
  });
});
