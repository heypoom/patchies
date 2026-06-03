import { javascriptLanguage } from '@codemirror/lang-javascript';
import { EditorState } from '@codemirror/state';
import { describe, expect, it } from 'vitest';
import { glslInJsWrap } from '$lib/codemirror/glsl-in-js';
import { glslLanguage } from '$lib/codemirror/glsl.codemirror';
import { peppermintLanguage } from '$lib/codemirror/peppermint.codemirror';
import {
  VALUE_WIDGET_GLSL_RUN_THROTTLE_MS,
  VALUE_WIDGET_SHADERPARK_RUN_THROTTLE_MS,
  shouldRunOnValueWidgetChange,
  valueWidgetRunThrottleMs
} from '$lib/codemirror/value-widget-events';
import {
  dragDeltaForNumber,
  findInlineValueWidgets,
  formatDraggedNumber,
  formatNormalizedColorComponents,
  formatNormalizedVectorComponent,
  formatNormalizedVectorComponents,
  updateDraggedNumberComponent
} from '$lib/codemirror/value-widgets/index';

const jsState = (doc: string) =>
  EditorState.create({ doc, extensions: [javascriptLanguage.configure({ wrap: glslInJsWrap })] });

const glslState = (doc: string) => EditorState.create({ doc, extensions: [glslLanguage] });
const peppermintState = (doc: string) =>
  EditorState.create({ doc, extensions: [peppermintLanguage] });

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

  it('detects Shader Park vec2, vec3, and color calls as normalized widgets', () => {
    expect(
      labels(
        findInlineValueWidgets(
          jsState(
            'setStepSize(0.2);\nvec2(0.2, 0.8);\nvec3(0.46, 0.22, 0.35);\ncolor(0.5, 0.3, 0.5);'
          ),
          'javascript',
          { nodeType: 'shaderpark' }
        )
      )
    ).toEqual([
      { kind: 'number', text: '0.2', components: ['0.2'] },
      { kind: 'xy', text: 'vec2(0.2, 0.8)', components: ['0.2', '0.8'] },
      { kind: 'color', text: 'vec3(0.46, 0.22, 0.35)', components: ['0.46', '0.22', '0.35'] },
      { kind: 'color', text: 'color(0.5, 0.3, 0.5)', components: ['0.5', '0.3', '0.5'] }
    ]);
  });

  it('does not detect Shader Park vector calls as widgets in normal JavaScript editors', () => {
    expect(
      labels(
        findInlineValueWidgets(
          jsState('vec2(0.2, 0.8);\nvec3(0.46, 0.22, 0.35);\ncolor(0.5, 0.3, 0.5);'),
          'javascript'
        )
      )
    ).toEqual([
      { kind: 'number', text: '0.2', components: ['0.2'] },
      { kind: 'number', text: '0.8', components: ['0.8'] },
      { kind: 'number', text: '0.46', components: ['0.46'] },
      { kind: 'number', text: '0.22', components: ['0.22'] },
      { kind: 'number', text: '0.35', components: ['0.35'] },
      { kind: 'number', text: '0.5', components: ['0.5'] },
      { kind: 'number', text: '0.3', components: ['0.3'] },
      { kind: 'number', text: '0.5', components: ['0.5'] }
    ]);
  });

  it('detects Peppermint integer and float scalar numbers', () => {
    expect(
      labels(
        findInlineValueWidgets(
          peppermintState('take(5)\nthreshold = 0.75\namount = -2'),
          'peppermint'
        )
      )
    ).toEqual([
      { kind: 'number', text: '5', components: ['5'] },
      { kind: 'number', text: '0.75', components: ['0.75'] },
      { kind: 'number', text: '-2', components: ['-2'] }
    ]);
  });

  it('ignores Peppermint numbers in strings and comments', () => {
    expect(
      labels(
        findInlineValueWidgets(
          peppermintState('label = "score 0.75"\n# take 5\nscore = 0.9'),
          'peppermint'
        )
      )
    ).toEqual([{ kind: 'number', text: '0.9', components: ['0.9'] }]);
  });

  it('detects two-number JavaScript arrays with uneven whitespace and inclusive 0..1 values', () => {
    expect(
      labels(findInlineValueWidgets(jsState('[0.8, 0.5]\n[0,  0.5]\n[0.3,    1]'), 'javascript'))
    ).toEqual([
      { kind: 'xy', text: '[0.8, 0.5]', components: ['0.8', '0.5'] },
      { kind: 'xy', text: '[0,  0.5]', components: ['0', '0.5'] },
      { kind: 'xy', text: '[0.3,    1]', components: ['0.3', '1'] }
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

  it('uses a whole-number drag scale for integer literals', () => {
    expect(dragDeltaForNumber('10', 1)).toBe(0.05);
    expect(dragDeltaForNumber('10', -2)).toBe(-0.1);
    expect(dragDeltaForNumber('10.0', 1)).toBe(0.01);
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
    expect(formatNormalizedVectorComponent('0', -0.5)).toBe('0.000');
    expect(formatNormalizedVectorComponent('1', 0.5)).toBe('0.500');
  });

  it('formats normalized vector pairs with the maximum existing precision', () => {
    const widget = findInlineValueWidgets(glslState('vec2 point = vec2(0.1, 0.222);'), 'glsl').find(
      (item) => item.kind === 'xy'
    );

    expect(widget).toBeDefined();
    expect(
      formatNormalizedVectorComponents([widget!.components[0], widget!.components[1]], [0.4, 0.75])
    ).toEqual(['0.400', '0.750']);
  });

  it('formats hex colors into normalized component text for GLSL vec3 colors', () => {
    const widget = findInlineValueWidgets(
      glslState('vec3 color = vec3(1.0, 0.5, 0.0);'),
      'glsl'
    ).find((item) => item.kind === 'color');

    expect(widget).toBeDefined();
    expect(formatNormalizedColorComponents(widget!.components, '#336699')).toEqual([
      '0.2',
      '0.4',
      '0.6'
    ]);
  });

  it('formats GLSL vec3 color components with the maximum existing precision', () => {
    const widget = findInlineValueWidgets(
      glslState('vec3 color = vec3(0.1, 0.22, 0.333);'),
      'glsl'
    ).find((item) => item.kind === 'color');

    expect(widget).toBeDefined();
    expect(formatNormalizedColorComponents(widget!.components, '#336699')).toEqual([
      '0.200',
      '0.400',
      '0.600'
    ]);
  });

  it('auto-runs inline widget edits for GLSL and Shader Park editors', () => {
    expect(shouldRunOnValueWidgetChange('glsl')).toBe(true);
    expect(shouldRunOnValueWidgetChange('javascript', 'shaderpark')).toBe(true);
    expect(shouldRunOnValueWidgetChange('javascript', 'p5')).toBe(false);
  });

  it('throttles expensive inline widget reruns', () => {
    expect(valueWidgetRunThrottleMs('glsl')).toBe(VALUE_WIDGET_GLSL_RUN_THROTTLE_MS);
    expect(valueWidgetRunThrottleMs('javascript', 'shaderpark')).toBe(
      VALUE_WIDGET_SHADERPARK_RUN_THROTTLE_MS
    );
    expect(valueWidgetRunThrottleMs('javascript', 'p5')).toBe(0);
  });
});
