import { describe, expect, it } from 'vitest';
import { CookStateManager } from './CookStateManager';

describe('CookStateManager', () => {
  it('cooks on the first frame, then caches an unchanged on-demand node', () => {
    const manager = new CookStateManager();

    manager.registerNode('glsl-1', { mode: 'on-demand' });
    manager.beginFrame({ transportTime: 0, prevTransportTime: 0, isTransportPlaying: false });

    expect(manager.shouldCook('glsl-1')).toEqual({
      shouldCook: true,
      reasons: ['first-frame']
    });

    manager.markCooked('glsl-1', ['first-frame'], 0.42);
    manager.beginFrame({ transportTime: 0, prevTransportTime: 0, isTransportPlaying: false });

    expect(manager.shouldCook('glsl-1')).toEqual({ shouldCook: false, reasons: [] });
    expect(manager.getStatus('glsl-1')).toMatchObject({
      status: 'cached',
      cookedFrames: 1,
      cachedFrames: 1,
      lastCookTimeMs: 0.42,
      lastCookReasons: ['first-frame']
    });
  });

  it('marks downstream nodes dirty when an upstream node cooks', () => {
    const manager = new CookStateManager();

    manager.registerNode('source', { mode: 'on-demand' });
    manager.registerNode('effect', { mode: 'on-demand' });
    manager.setOutputsByNode(new Map([['source', ['effect']]]));
    manager.beginFrame({ transportTime: 0, prevTransportTime: 0, isTransportPlaying: false });

    manager.markCooked('source', ['uniform'], 1.25);

    expect(manager.shouldCook('effect')).toEqual({
      shouldCook: true,
      reasons: ['first-frame', 'input']
    });
  });

  it('cooks iTime-dependent nodes only while transport time changes', () => {
    const manager = new CookStateManager();

    manager.registerNode('time-shader', { mode: 'on-demand', timeDependent: true });
    manager.beginFrame({ transportTime: 1, prevTransportTime: 0, isTransportPlaying: true });

    expect(manager.shouldCook('time-shader')).toEqual({
      shouldCook: true,
      reasons: ['first-frame', 'time']
    });

    manager.markCooked('time-shader', ['first-frame', 'time'], 0.8);
    manager.beginFrame({ transportTime: 1, prevTransportTime: 1, isTransportPlaying: false });

    expect(manager.shouldCook('time-shader')).toEqual({ shouldCook: false, reasons: [] });
  });

  it('keeps always-mode nodes cooking every frame', () => {
    const manager = new CookStateManager();

    manager.registerNode('hydra-1', { mode: 'always' });
    manager.beginFrame({ transportTime: 0, prevTransportTime: 0, isTransportPlaying: false });
    manager.markCooked('hydra-1', ['renderer-policy'], 0.5);
    manager.beginFrame({ transportTime: 0, prevTransportTime: 0, isTransportPlaying: false });

    expect(manager.shouldCook('hydra-1')).toEqual({
      shouldCook: true,
      reasons: ['renderer-policy']
    });
  });
});
