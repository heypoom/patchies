import { describe, expect, it } from 'vitest';
import { guardHtmlCanvasMode } from './html-canvas-mode-guard';

describe('guardHtmlCanvasMode', () => {
  it('allows the first htmlCanvas mode in a run', () => {
    expect(
      guardHtmlCanvasMode({
        currentMode: null,
        requestedMode: 'glslLayer',
        videoOutputEnabled: false
      })
    ).toEqual({ ok: true, mode: 'glslLayer' });
  });

  it('allows repeating the same htmlCanvas mode in a run', () => {
    expect(
      guardHtmlCanvasMode({
        currentMode: 'canvasLayer',
        requestedMode: 'canvasLayer',
        videoOutputEnabled: false
      })
    ).toEqual({ ok: true, mode: 'canvasLayer' });
  });

  it('rejects mixing htmlCanvas modes in the same run', () => {
    expect(
      guardHtmlCanvasMode({
        currentMode: 'videoOutput',
        requestedMode: 'glslLayer',
        videoOutputEnabled: false
      })
    ).toEqual({
      ok: false,
      message:
        'htmlCanvas.glslLayer() cannot be used with htmlCanvas.videoOutput() in the same run. Choose one of htmlCanvas.videoOutput(), htmlCanvas.canvasLayer(), or htmlCanvas.glslLayer().'
    });
  });

  it('rejects local layers while video output is already enabled', () => {
    expect(
      guardHtmlCanvasMode({
        currentMode: null,
        requestedMode: 'canvasLayer',
        videoOutputEnabled: true
      })
    ).toEqual({
      ok: false,
      message:
        'htmlCanvas.canvasLayer() cannot be used while htmlCanvas.videoOutput() is enabled. Call htmlCanvas.videoOutput(false) before enabling a local layer.'
    });
  });
});
