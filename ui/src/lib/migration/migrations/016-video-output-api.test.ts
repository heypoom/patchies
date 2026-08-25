import { describe, expect, test } from 'vitest';

import { migration016 } from './016-video-output-api';
import type { RawPatchData } from '../types';

function patchWithCode(type: string, code: string): RawPatchData {
  return {
    version: '15',
    nodes: [
      {
        id: `${type}-1`,
        type,
        position: { x: 0, y: 0 },
        data: { code }
      }
    ]
  };
}

function migratedCode(type: string, code: string) {
  return migration016.migrate(patchWithCode(type, code)).nodes?.[0]?.data.code;
}

describe('migration016', () => {
  test.each(['p5', 'canvas.dom', 'textmode.dom', 'three.dom', 'pixi.dom', 'surface'])(
    'removes a standalone legacy output call from %s',
    (type) => {
      expect(migratedCode(type, 'noOutput();\n\ndraw()')).toBe('draw()');
    }
  );

  test.each(['p5', 'canvas.dom', 'textmode.dom', 'three.dom', 'pixi.dom', 'surface'])(
    'preserves enabled output for %s',
    (type) => {
      expect(migratedCode(type, 'draw()')).toBe('setVideoOutput(true)\n\ndraw()');
    }
  );

  test.each(['canvas', 'regl', 'textmode', 'three'])('preserves disabled output for %s', (type) => {
    expect(migratedCode(type, 'noOutput()\ndraw()')).toBe('setVideoOutput(false)\ndraw()');
  });

  test('does not duplicate an existing video output setter', () => {
    const code = 'setVideoOutput(true)\n\ndraw()';

    expect(migratedCode('p5', code)).toBe(code);
  });

  test('leaves non-standalone legacy usage unchanged', () => {
    const code = 'if (debug) noOutput()';

    expect(migratedCode('canvas.dom', code)).toBe(code);
  });
});
