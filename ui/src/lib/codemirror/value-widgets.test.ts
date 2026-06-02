import { javascriptLanguage } from '@codemirror/lang-javascript';
import { EditorState } from '@codemirror/state';
import { describe, expect, it } from 'vitest';
import { glslInJsWrap } from '$lib/codemirror/glsl-in-js';
import { glslLanguage } from '$lib/codemirror/glsl.codemirror';
import {
  findInlineValueWidgets,
  formatDraggedNumber,
  formatNormalizedVectorComponent,
  updateDraggedNumberComponent
} from '$lib/codemirror/value-widgets';

const jsState = (doc: string) =>
  EditorState.create({ doc, extensions: [javascriptLanguage.configure({ wrap: glslInJsWrap })] });

const glslState = (doc: string) => EditorState.create({ doc, extensions: [glslLanguage] });

const labels = (widgets: ReturnType<typeof findInlineValueWidgets>) =>
  widgets.map((widget) => ({
    kind: widget.kind,
    text: widget.text,
    components: widget.components.map((component) => component.text)
  }));

describe('CodeMirror inline value widgets', () => {
  it('detects GLSL scalar numbers and normalized vec2 values', () => {
    expect(
      labels(
        findInlineValueWidgets(
          glslState('float speed = -1.25;\nvec2 p = vec2(0.25, 0.75);'),
          'glsl'
        )
      )
    ).toEqual([
      { kind: 'number', text: '-1.25', components: ['-1.25'] },
      { kind: 'xy', text: 'vec2(0.25, 0.75)', components: ['0.25', '0.75'] }
    ]);
  });

  it('detects normalized GLSL vec3 values as colors only when all components are 0..1', () => {
    expect(
      labels(
        findInlineValueWidgets(
          glslState('vec3 good = vec3(1.0, 0.5, 0.0);\nvec3 wide = vec3(1.5, 0.5, 0.0);'),
          'glsl'
        )
      )
    ).toEqual([
      { kind: 'color', text: 'vec3(1.0, 0.5, 0.0)', components: ['1.0', '0.5', '0.0'] },
      { kind: 'number', text: '1.5', components: ['1.5'] },
      { kind: 'number', text: '0.5', components: ['0.5'] },
      { kind: 'number', text: '0.0', components: ['0.0'] }
    ]);
  });

  it('detects normalized JavaScript arrays and ignores normal strings', () => {
    expect(
      labels(
        findInlineValueWidgets(
          jsState('const p = [0.25, 0.75];\nconst color = [1.0, 0.5, 0.0];\nconst label = "0.5";'),
          'javascript'
        )
      )
    ).toEqual([
      { kind: 'xy', text: '[0.25, 0.75]', components: ['0.25', '0.75'] },
      { kind: 'color', text: '[1.0, 0.5, 0.0]', components: ['1.0', '0.5', '0.0'] }
    ]);
  });

  it('uses GLSL detection inside recognized GLSL-in-JS template strings', () => {
    expect(
      labels(
        findInlineValueWidgets(
          jsState('const shader = glsl`vec3 color = vec3(1.0, 0.5, 0.0);`;'),
          'javascript'
        )
      )
    ).toEqual([{ kind: 'color', text: 'vec3(1.0, 0.5, 0.0)', components: ['1.0', '0.5', '0.0'] }]);
  });

  it('preserves integer and decimal precision when formatting dragged numbers', () => {
    expect(formatDraggedNumber('3', 1)).toBe('4');
    expect(formatDraggedNumber('-2', -1)).toBe('-3');
    expect(formatDraggedNumber('1.00', 0.25)).toBe('1.25');
    expect(formatDraggedNumber('0.5', -0.125)).toBe('0.4');
  });

  it('updates the active drag range when a formatted number changes length', () => {
    const component = { from: 4, to: 6, text: '10', value: 10 };

    expect(updateDraggedNumberComponent(component, '100')).toEqual({
      from: 4,
      to: 7,
      text: '100',
      value: 100
    });
  });

  it('formats normalized vector drag values with existing decimal precision', () => {
    expect(formatNormalizedVectorComponent('0.570', 0.2)).toBe('0.200');
    expect(formatNormalizedVectorComponent('1.0', 0.125)).toBe('0.1');
    expect(formatNormalizedVectorComponent('.50', 1.2)).toBe('1.00');
    expect(formatNormalizedVectorComponent('0', -0.5)).toBe('0');
  });
});
