import { describe, expect, it } from 'vitest';
import {
  createCodeOverlayMirrorState,
  createDetachedStrudelCodeOverlayMirrorState,
  dispatchOutputToMainMessage,
  hasConnectedOutputWindow,
  highlightCodeOverlayValue,
  syncCanvasSizeToBitmap
} from './secondary-output-ipc';
import type { CodeEditorTarget } from '../../stores/code-editor-layout.store';

describe('secondary output IPC', () => {
  it('creates a serializable display-only code overlay state from an overlay target', () => {
    const target: CodeEditorTarget = {
      nodeId: 'node-1',
      dataKey: 'code',
      language: 'javascript',
      nodeType: 'p5',
      title: 'Sketch',
      placeholder: 'Write code',
      onrun: () => {},
      mode: 'overlay'
    };

    expect(createCodeOverlayMirrorState(target, 'circle(20, 20, 10)', 28, 0.72)).toEqual({
      nodeId: 'node-1',
      dataKey: 'code',
      value: 'circle(20, 20, 10)',
      language: 'javascript',
      nodeType: 'p5',
      title: 'Sketch',
      fontSizePx: 28,
      transparency: 0.72
    });
  });

  it('does not mirror sidebar targets', () => {
    const target: CodeEditorTarget = {
      nodeId: 'node-1',
      dataKey: 'code',
      language: 'javascript',
      mode: 'sidebar'
    };

    expect(createCodeOverlayMirrorState(target, 'code', 28, 0.72)).toBeNull();
  });

  it('creates a display-only code overlay state for detached strudel code', () => {
    expect(
      createDetachedStrudelCodeOverlayMirrorState('strudel-1', 's("bd sd")', 28, 0.72)
    ).toEqual({
      nodeId: 'strudel-1',
      dataKey: 'code',
      value: 's("bd sd")',
      language: 'javascript',
      nodeType: 'strudel',
      title: 'strudel',
      fontSizePx: 28,
      transparency: 0.72
    });
  });

  it('routes output surface input messages to the active sink', () => {
    const events: unknown[] = [];
    const sink = {
      pointer: (event: unknown) => events.push(['pointer', event]),
      wheel: (event: unknown) => events.push(['wheel', event]),
      touch: (touches: unknown) => events.push(['touch', touches]),
      leave: () => events.push(['leave'])
    };

    dispatchOutputToMainMessage(
      {
        type: 'outputSurfacePointer',
        event: { x: 0.25, y: 0.5, pressure: 0, buttons: 1, down: true, type: 'down' }
      },
      sink
    );

    dispatchOutputToMainMessage(
      {
        type: 'outputSurfaceWheel',
        event: { x: 0.25, y: 0.5, deltaX: 0, deltaY: -12, deltaMode: 0 }
      },
      sink
    );

    dispatchOutputToMainMessage(
      {
        type: 'outputSurfaceTouch',
        touches: [{ id: 1, x: 0.25, y: 0.5, pressure: 0.5 }]
      },
      sink
    );

    dispatchOutputToMainMessage({ type: 'outputSurfaceLeave' }, sink);

    expect(events).toEqual([
      ['pointer', { x: 0.25, y: 0.5, pressure: 0, buttons: 1, down: true, type: 'down' }],
      ['wheel', { x: 0.25, y: 0.5, deltaX: 0, deltaY: -12, deltaMode: 0 }],
      ['touch', [{ id: 1, x: 0.25, y: 0.5, pressure: 0.5 }]],
      ['leave']
    ]);
  });

  it('ignores output surface input messages without an active sink', () => {
    expect(() =>
      dispatchOutputToMainMessage(
        {
          type: 'outputSurfacePointer',
          event: { x: 0, y: 0, pressure: 0, buttons: 0, down: false, type: 'move' }
        },
        null
      )
    ).not.toThrow();
  });

  it('highlights display-only code overlay values while escaping unknown languages', () => {
    const highlighted = highlightCodeOverlayValue('const value = 1;', 'javascript');
    const plain = highlightCodeOverlayValue('<script>alert(1)</script>', 'uiua');

    expect(highlighted).toContain('hljs-keyword');
    expect(plain).toBe('&lt;script&gt;alert(1)&lt;/script&gt;');
  });

  it('syncs mirror canvas dimensions to incoming bitmap dimensions', () => {
    const canvas = { width: 1920, height: 1080 } as HTMLCanvasElement;
    const bitmap = { width: 1008, height: 654 } as ImageBitmap;

    syncCanvasSizeToBitmap(canvas, bitmap);

    expect(canvas.width).toBe(1008);
    expect(canvas.height).toBe(654);
  });

  it('treats a non-closed output window as connected', () => {
    expect(hasConnectedOutputWindow(null)).toBe(false);
    expect(hasConnectedOutputWindow({ closed: true })).toBe(false);
    expect(hasConnectedOutputWindow({ closed: false })).toBe(true);
  });
});
