import { describe, expect, it } from 'vitest';
import { getStandardEdgeClass } from './edge-style';

describe('getStandardEdgeClass', () => {
  it('uses selected color and glow instead of type color when background output is enabled', () => {
    const edgeClass = getStandardEdgeClass({
      type: 'video',
      selected: true,
      isBackgroundOutputCanvasEnabled: true
    });

    expect(edgeClass).toContain('!stroke-yellow-300');
    expect(edgeClass).toContain('edge-selected-glow');
    expect(edgeClass).not.toContain('!stroke-orange-400');
  });

  it('uses selected color and glow instead of type color when background output is disabled', () => {
    const edgeClass = getStandardEdgeClass({
      type: 'audio',
      selected: true,
      isBackgroundOutputCanvasEnabled: false
    });

    expect(edgeClass).toContain('!stroke-yellow-300');
    expect(edgeClass).toContain('edge-selected-glow');
    expect(edgeClass).not.toContain('!stroke-blue-400');
  });

  it('does not apply deselected opacity to selected message edges', () => {
    const edgeClass = getStandardEdgeClass({
      type: 'message',
      selected: true,
      isBackgroundOutputCanvasEnabled: true
    });

    expect(edgeClass).toContain('!stroke-yellow-300');
    expect(edgeClass).toContain('edge-selected-glow');
    expect(edgeClass).not.toContain('opacity-60');
  });

  it('keeps type colors for unselected edges', () => {
    const edgeClass = getStandardEdgeClass({
      type: 'message',
      selected: false,
      isBackgroundOutputCanvasEnabled: true
    });

    expect(edgeClass).toContain('!stroke-zinc-200');
    expect(edgeClass).toContain('opacity-60');
    expect(edgeClass).not.toContain('edge-selected-glow');
  });
});
