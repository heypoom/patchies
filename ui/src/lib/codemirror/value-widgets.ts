import { syntaxTree } from '@codemirror/language';
import type { EditorState, Extension } from '@codemirror/state';
import { RangeSetBuilder } from '@codemirror/state';
import {
  Decoration,
  EditorView,
  ViewPlugin,
  WidgetType,
  type DecorationSet,
  type PluginValue,
  type ViewUpdate
} from '@codemirror/view';
import type { Input, SyntaxNode, SyntaxNodeRef, Tree } from '@lezer/common';
import { javascriptLanguage } from '@codemirror/lang-javascript';
import { glslLanguage } from '$lib/codemirror/glsl.codemirror';
import { isGlslTemplateString } from '$lib/codemirror/glsl-in-js';
import {
  VALUE_WIDGET_CHANGE_EVENT,
  VALUE_WIDGET_VIEWPORT_CHANGE_EVENT
} from '$lib/codemirror/value-widget-events';

export type InlineValueWidgetKind = 'number' | 'xy' | 'color';

export interface InlineValueComponent {
  from: number;
  to: number;
  text: string;
  value: number;
}

export interface InlineValueWidgetInfo {
  kind: InlineValueWidgetKind;
  from: number;
  to: number;
  text: string;
  components: InlineValueComponent[];
  colorPicker?: boolean;
}

interface EmbeddedRange {
  from: number;
  to: number;
}

interface NormalizedPoint {
  x: number;
  y: number;
}

interface GridRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

interface GridPosition {
  left: number;
  top: number;
}

type VectorComponentTexts = [string, string] | [string, string, string];

interface InlineValueWidgetContext {
  nodeType?: string;
}

function readDoc(state: EditorState, from: number, to: number) {
  return state.doc.sliceString(from, to);
}

function directChildren(node: SyntaxNode): SyntaxNode[] {
  const children: SyntaxNode[] = [];

  for (let child = node.firstChild; child; child = child.nextSibling) {
    children.push(child);
  }

  return children;
}

function isFiniteNumberText(text: string) {
  return /^-?(?:\d+\.?\d*|\.\d+)$/.test(text);
}

type NumericSyntaxNode = Pick<SyntaxNode | SyntaxNodeRef, 'name' | 'from' | 'to'> & {
  parent?: SyntaxNode | null;
  node?: SyntaxNode;
};

function numericComponentFromNode(
  state: EditorState,
  node: NumericSyntaxNode,
  offset = 0
): InlineValueComponent | null {
  if (node.name !== 'Number') return null;

  let from = node.from + offset;
  let to = node.to + offset;
  const parent = node.node?.parent ?? node.parent ?? null;

  if (parent?.name === 'UnaryExpression') {
    const parentText = readDoc(state, parent.from + offset, parent.to + offset);
    if (/^-\s*(?:\d+\.?\d*|\.\d+)$/.test(parentText)) {
      from = parent.from + offset;
      to = parent.to + offset;
    }
  }

  const text = readDoc(state, from, to);
  if (!isFiniteNumberText(text)) return null;

  return {
    from,
    to,
    text,
    value: Number(text)
  };
}

function isNormalized(components: InlineValueComponent[]) {
  return components.every((component) => component.value >= 0 && component.value <= 1);
}

function componentKey(component: InlineValueComponent) {
  return `${component.from}:${component.to}`;
}

function addVectorWidget(
  widgets: InlineValueWidgetInfo[],
  consumedNumbers: Set<string>,
  kind: Extract<InlineValueWidgetKind, 'xy' | 'color'>,
  state: EditorState,
  from: number,
  to: number,
  components: InlineValueComponent[],
  options: { colorPicker?: boolean } = {}
) {
  if (!isNormalized(components)) return;

  widgets.push({
    kind,
    from,
    to,
    text: readDoc(state, from, to),
    components,
    colorPicker: kind === 'color' ? options.colorPicker : undefined
  });

  components.forEach((component) => consumedNumbers.add(componentKey(component)));
}

function collectGlslValueWidgetsFromTree(
  state: EditorState,
  tree: Tree,
  from: number,
  to: number,
  offset = 0
) {
  const widgets: InlineValueWidgetInfo[] = [];
  const consumedNumbers = new Set<string>();

  tree.iterate({
    from,
    to,
    enter(node) {
      if (node.name !== 'CallExpression') return;

      const children = directChildren(node.node);
      const callee = children[0];
      const args = children.find((child) => child.name === 'ArgumentList');
      if (!callee || !args) return;

      const calleeText = readDoc(state, callee.from + offset, callee.to + offset);
      if (calleeText !== 'vec2' && calleeText !== 'vec3') return;

      const components = directChildren(args)
        .map((child) => numericComponentFromNode(state, child, offset))
        .filter((component): component is InlineValueComponent => component !== null);

      const expectedComponentCount = calleeText === 'vec2' ? 2 : 3;
      if (components.length !== expectedComponentCount) return;

      addVectorWidget(
        widgets,
        consumedNumbers,
        calleeText === 'vec2' ? 'xy' : 'color',
        state,
        node.from + offset,
        node.to + offset,
        components,
        { colorPicker: calleeText === 'vec3' }
      );
    }
  });

  tree.iterate({
    from,
    to,
    enter(node) {
      const component = numericComponentFromNode(state, node, offset);
      if (!component || consumedNumbers.has(componentKey(component))) return;

      widgets.push({
        kind: 'number',
        from: component.from,
        to: component.to,
        text: component.text,
        components: [component]
      });
    }
  });

  return widgets;
}

function collectJavaScriptValueWidgetsFromTree(
  state: EditorState,
  tree: Tree,
  context?: InlineValueWidgetContext
) {
  const widgets: InlineValueWidgetInfo[] = [];
  const consumedNumbers = new Set<string>();

  tree.iterate({
    enter(node) {
      if (node.name !== 'ArrayExpression' && node.name !== 'SequenceExpression') return;

      const bracketFrom = node.name === 'SequenceExpression' ? node.from - 1 : node.from;
      const bracketTo = node.name === 'SequenceExpression' ? node.to + 1 : node.to;

      if (
        bracketFrom < 0 ||
        bracketTo > state.doc.length ||
        readDoc(state, bracketFrom, bracketFrom + 1) !== '[' ||
        readDoc(state, bracketTo - 1, bracketTo) !== ']'
      ) {
        return;
      }

      const components = directChildren(node.node)
        .map((child) => numericComponentFromNode(state, child))
        .filter((component): component is InlineValueComponent => component !== null);

      if (components.length !== 2 && components.length !== 3) return;

      addVectorWidget(
        widgets,
        consumedNumbers,
        components.length === 2 ? 'xy' : 'color',
        state,
        bracketFrom,
        bracketTo,
        components
      );
    }
  });

  if (context?.nodeType === 'shaderpark') {
    tree.iterate({
      enter(node) {
        if (node.name !== 'CallExpression') return;

        const children = directChildren(node.node);
        const callee = children[0];
        const args = children.find((child) => child.name === 'ArgList');
        if (!callee || !args) return;

        const calleeText = readDoc(state, callee.from, callee.to);
        if (calleeText !== 'vec3' && calleeText !== 'color') return;

        const components = directChildren(args)
          .map((child) => numericComponentFromNode(state, child))
          .filter((component): component is InlineValueComponent => component !== null);

        if (components.length !== 3) return;

        addVectorWidget(widgets, consumedNumbers, 'color', state, node.from, node.to, components, {
          colorPicker: true
        });
      }
    });
  }

  tree.iterate({
    enter(node) {
      const component = numericComponentFromNode(state, node);
      if (!component || consumedNumbers.has(componentKey(component))) return;

      widgets.push({
        kind: 'number',
        from: component.from,
        to: component.to,
        text: component.text,
        components: [component]
      });
    }
  });

  return widgets;
}

function glslTemplateContentRanges(node: SyntaxNodeRef): EmbeddedRange[] {
  const ranges: EmbeddedRange[] = [];
  let pos = node.from + 1;
  const end = node.to - 1;

  for (let child = node.node.firstChild; child; child = child.nextSibling) {
    if (child.name === 'Interpolation') {
      if (pos < child.from) {
        ranges.push({ from: pos, to: child.from });
      }

      pos = child.to;
    }
  }

  if (pos < end) {
    ranges.push({ from: pos, to: end });
  }

  return ranges;
}

function findGlslInJsRanges(state: EditorState) {
  const doc = state.doc.toString();
  const input = {
    read: (from: number, to: number) => doc.slice(from, to)
  } as Input;
  const ranges: EmbeddedRange[] = [];
  const tree = javascriptLanguage.parser.parse(doc);

  tree.iterate({
    enter(node) {
      if (node.name !== 'TemplateString') return;
      if (!isGlslTemplateString(node, input)) return;

      ranges.push(...glslTemplateContentRanges(node));
    }
  });

  return ranges;
}

function isInsideAnyRange(widget: InlineValueWidgetInfo, ranges: EmbeddedRange[]) {
  return ranges.some((range) => widget.from >= range.from && widget.to <= range.to);
}

export function findInlineValueWidgets(
  state: EditorState,
  language: 'javascript' | 'glsl',
  context?: InlineValueWidgetContext
): InlineValueWidgetInfo[] {
  if (language === 'glsl') {
    const tree = syntaxTree(state);
    return collectGlslValueWidgetsFromTree(state, tree, 0, state.doc.length).sort(compareWidgets);
  }

  const glslRanges = findGlslInJsRanges(state);
  const jsWidgets = collectJavaScriptValueWidgetsFromTree(state, syntaxTree(state), context).filter(
    (widget) => !isInsideAnyRange(widget, glslRanges)
  );

  const glslWidgets = glslRanges.flatMap((range) => {
    const tree = glslLanguage.parser.parse(readDoc(state, range.from, range.to));
    return collectGlslValueWidgetsFromTree(state, tree, 0, range.to - range.from, range.from);
  });

  return [...jsWidgets, ...glslWidgets].sort(compareWidgets);
}

function compareWidgets(a: InlineValueWidgetInfo, b: InlineValueWidgetInfo) {
  return a.from - b.from || b.to - a.to;
}

function decimalPlaces(text: string) {
  const index = text.indexOf('.');
  return index === -1 ? 0 : text.length - index - 1;
}

export function formatDraggedNumber(text: string, delta: number) {
  const precision = decimalPlaces(text);
  const nextValue = Number(text) + delta;

  if (precision === 0) {
    return String(Math.round(nextValue));
  }

  return nextValue.toFixed(precision);
}

export function dragDeltaForNumber(text: string, pixelDelta: number) {
  const precision = decimalPlaces(text);
  const step = precision === 0 ? 0.05 : 0.01;

  return pixelDelta * step;
}

export function updateDraggedNumberComponent(
  component: InlineValueComponent,
  nextText: string
): InlineValueComponent {
  return {
    from: component.from,
    to: component.from + nextText.length,
    text: nextText,
    value: Number(nextText)
  };
}

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

export function formatNormalizedVectorComponent(text: string, value: number) {
  const clamped = clamp01(value);
  const precision = text.includes('.') ? decimalPlaces(text) : 3;
  const prefix = text.startsWith('.') ? '.' : '';

  const fixed = clamped.toFixed(precision);
  return prefix ? fixed.replace(/^0\./, '.') : fixed;
}

function colorForComponents(components: InlineValueComponent[]) {
  const [r, g, b] = components.map((component) =>
    Math.max(0, Math.min(255, Math.round(component.value * 255)))
  );

  return `rgb(${r}, ${g}, ${b})`;
}

function hexColorForComponents(components: InlineValueComponent[]) {
  const channels = components.map((component) =>
    Math.max(0, Math.min(255, Math.round(component.value * 255)))
  );

  return `#${channels.map((channel) => channel.toString(16).padStart(2, '0')).join('')}`;
}

function normalizedColorValueFromHex(hex: string) {
  const match = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!match) return null;

  const value = match[1];

  return [0, 2, 4].map((index) => parseInt(value.slice(index, index + 2), 16) / 255) as [
    number,
    number,
    number
  ];
}

export function formatNormalizedColorComponents(components: InlineValueComponent[], hex: string) {
  const values = normalizedColorValueFromHex(hex);
  if (!values || components.length !== 3) return null;

  return values.map((value, index) =>
    formatNormalizedVectorComponent(components[index].text, value)
  ) as [string, string, string];
}

class ValueCueWidget extends WidgetType {
  constructor(readonly info: InlineValueWidgetInfo) {
    super();
  }

  eq(other: ValueCueWidget) {
    return (
      other.info.kind === this.info.kind &&
      other.info.text === this.info.text &&
      other.info.components.map((component) => component.text).join(',') ===
        this.info.components.map((component) => component.text).join(',')
    );
  }

  toDOM() {
    const cue = document.createElement('span');
    cue.className = `cm-value-widget cm-value-widget-${this.info.kind}`;
    cue.dataset.valueWidgetKind = this.info.kind;
    cue.dataset.valueWidgetFrom = String(this.info.from);
    cue.dataset.valueWidgetTo = String(this.info.to);
    cue.setAttribute('aria-hidden', 'true');

    if (this.info.kind === 'color') {
      cue.style.backgroundColor = colorForComponents(this.info.components);
    }

    return cue;
  }

  ignoreEvent() {
    return false;
  }
}

function createXYGridDom(info: InlineValueWidgetInfo) {
  const grid = document.createElement('span');
  grid.className = 'cm-value-widget-xy-grid';
  grid.dataset.valueWidgetFrom = String(info.from);
  grid.dataset.valueWidgetTo = String(info.to);
  Object.assign(grid.style, {
    position: 'fixed',
    zIndex: '10000',
    width: '160px',
    height: '160px',
    border: '1px solid rgba(161, 161, 170, 0.9)',
    backgroundColor: 'rgba(24, 24, 27, 0.96)',
    backgroundImage:
      'linear-gradient(rgba(161, 161, 170, 0.24) 1px, transparent 1px), linear-gradient(90deg, rgba(161, 161, 170, 0.24) 1px, transparent 1px), linear-gradient(rgba(244, 244, 245, 0.42) 1px, transparent 1px), linear-gradient(90deg, rgba(244, 244, 245, 0.42) 1px, transparent 1px)',
    backgroundSize: '16px 16px, 16px 16px, 80px 80px, 80px 80px',
    boxShadow: '0 10px 28px rgba(0, 0, 0, 0.45)',
    cursor: 'crosshair',
    boxSizing: 'border-box'
  });

  const dot = document.createElement('span');
  dot.className = 'cm-value-widget-xy-dot';

  const [x, y] = info.components;
  dot.style.left = `${x.value * 100}%`;
  dot.style.top = `${(1 - y.value) * 100}%`;
  Object.assign(dot.style, {
    position: 'absolute',
    width: '8px',
    height: '8px',
    borderRadius: '999px',
    backgroundColor: 'rgb(244, 244, 245)',
    border: '1px solid rgb(9, 9, 11)',
    transform: 'translate(-50%, -50%)',
    pointerEvents: 'none',
    boxSizing: 'border-box'
  });

  grid.appendChild(dot);

  return grid;
}

function buildValueDecorations(
  view: EditorView,
  language: 'javascript' | 'glsl',
  numberModifierActive: boolean,
  hoveredWidget: InlineValueWidgetInfo | null
) {
  const builder = new RangeSetBuilder<Decoration>();
  if (!hoveredWidget || !numberModifierActive) return builder.finish();

  if (hoveredWidget.kind === 'number') {
    if (numberModifierActive) {
      const decoration = Decoration.mark({ class: 'cm-value-widget-number-active' });
      builder.add(hoveredWidget.from, hoveredWidget.to, decoration);
    }

    return builder.finish();
  }

  const activeValueDecoration = Decoration.mark({ class: 'cm-value-widget-active' });
  builder.add(hoveredWidget.from, hoveredWidget.to, activeValueDecoration);

  if (hoveredWidget.kind === 'xy') {
    return builder.finish();
  }

  const decoration = Decoration.widget({
    widget: new ValueCueWidget(hoveredWidget),
    side: 1
  });

  builder.add(hoveredWidget.to, hoveredWidget.to, decoration);

  return builder.finish();
}

interface DragState {
  kind: 'number';
  component: InlineValueComponent;
  startY: number;
  startText: string;
}

interface XYDragState {
  kind: 'xy';
  widget: InlineValueWidgetInfo;
  gridRect: GridRect;
}

type ActiveDragState = DragState | XYDragState;

const isActivationDrag = (event: MouseEvent) =>
  navigator.platform.toLowerCase().includes('mac') ? event.altKey : event.ctrlKey;

const isActivationKey = (event: KeyboardEvent) =>
  navigator.platform.toLowerCase().includes('mac') ? event.key === 'Alt' : event.key === 'Control';

function findNearestComponent(widget: InlineValueWidgetInfo, pos: number) {
  return (
    widget.components.find((component) => pos >= component.from && pos <= component.to) ??
    widget.components[0]
  );
}

function sameWidget(a: InlineValueWidgetInfo | null, b: InlineValueWidgetInfo | null) {
  return a?.from === b?.from && a?.to === b?.to && a?.kind === b?.kind;
}

function findWidgetAtPos(
  state: EditorState,
  language: 'javascript' | 'glsl',
  pos: number,
  context?: InlineValueWidgetContext
): InlineValueWidgetInfo | null {
  return (
    findInlineValueWidgets(state, language, context).find(
      (widget) =>
        (pos >= widget.from && pos <= widget.to) ||
        widget.components.some((component) => pos >= component.from && pos <= component.to + 1)
    ) ?? null
  );
}

function isHTMLElement(value: EventTarget | null): value is HTMLElement {
  return value instanceof HTMLElement;
}

function getWidgetDatasetTarget(event: MouseEvent) {
  if (!isHTMLElement(event.target)) return null;

  return event.target.closest<HTMLElement>(
    '.cm-value-widget, .cm-value-widget-xy-grid, .cm-value-widget-color-picker'
  );
}

function isXYGridTarget(event: MouseEvent) {
  if (!isHTMLElement(event.target)) return false;

  return !!event.target.closest('.cm-value-widget-xy-grid');
}

function isValueWidgetOverlayTarget(event: MouseEvent) {
  if (!isHTMLElement(event.target)) return false;

  return !!event.target.closest('.cm-value-widget-xy-grid, .cm-value-widget-color-picker');
}

function gridRectFromEvent(event: MouseEvent): GridRect | null {
  if (!isHTMLElement(event.target)) return null;
  const grid = event.target.closest<HTMLElement>('.cm-value-widget-xy-grid');
  if (!grid) return null;
  const rect = grid.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) return null;

  return {
    left: rect.left,
    top: rect.top,
    width: rect.width,
    height: rect.height
  };
}

function gridRectFromElement(grid: HTMLElement): GridRect | null {
  const rect = grid.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) return null;

  return {
    left: rect.left,
    top: rect.top,
    width: rect.width,
    height: rect.height
  };
}

function pointFromGridRect(event: MouseEvent, rect: GridRect): NormalizedPoint {
  return {
    x: clamp01((event.clientX - rect.left) / rect.width),
    y: clamp01(1 - (event.clientY - rect.top) / rect.height)
  };
}

function findWidgetFromDataset(
  state: EditorState,
  language: 'javascript' | 'glsl',
  target: HTMLElement | null,
  context?: InlineValueWidgetContext
) {
  if (!target) return null;

  const from = Number(target.dataset.valueWidgetFrom);
  const to = Number(target.dataset.valueWidgetTo);
  if (!Number.isFinite(from) || !Number.isFinite(to)) return null;

  return (
    findInlineValueWidgets(state, language, context).find(
      (widget) => widget.from === from && widget.to === to
    ) ?? null
  );
}

function dispatchValueWidgetChange(view: EditorView) {
  view.dom.dispatchEvent(
    new CustomEvent<{ value: string }>(VALUE_WIDGET_CHANGE_EVENT, {
      detail: { value: view.state.doc.toString() },
      bubbles: true
    })
  );
}

function updateVectorWidgetComponents(
  widget: InlineValueWidgetInfo,
  nextTexts: VectorComponentTexts
): InlineValueWidgetInfo {
  let cumulativeDelta = 0;
  const components = widget.components.map((component, index) => {
    const nextText = nextTexts[index];
    if (!nextText) return component;

    const nextComponent = updateDraggedNumberComponent(
      {
        ...component,
        from: component.from + cumulativeDelta,
        to: component.to + cumulativeDelta
      },
      nextText
    );

    cumulativeDelta += nextText.length - component.text.length;

    return nextComponent;
  });

  return {
    ...widget,
    to: widget.to + cumulativeDelta,
    components
  };
}

export function inlineValueWidgets(
  language: 'javascript' | 'glsl',
  context?: InlineValueWidgetContext
): Extension {
  class InlineValuePluginValue implements PluginValue {
    decorations: DecorationSet;
    dragState: ActiveDragState | null = null;
    hoveredWidget: InlineValueWidgetInfo | null = null;
    activeXYWidget: InlineValueWidgetInfo | null = null;
    numberModifierActive = false;
    xyGrid: HTMLElement | null = null;
    colorInput: HTMLInputElement | null = null;

    constructor(readonly view: EditorView) {
      this.decorations = buildValueDecorations(
        view,
        language,
        this.numberModifierActive,
        this.hoveredWidget
      );

      view.dom.addEventListener(VALUE_WIDGET_VIEWPORT_CHANGE_EVENT, this.handleViewportChange);
    }

    update(update: ViewUpdate) {
      if (
        update.docChanged ||
        update.viewportChanged ||
        syntaxTree(update.startState) !== syntaxTree(update.state)
      ) {
        this.decorations = buildValueDecorations(
          update.view,
          language,
          this.numberModifierActive,
          this.hoveredWidget
        );
      }

      this.syncXYGrid();
    }

    destroy() {
      this.view.dom.removeEventListener(
        VALUE_WIDGET_VIEWPORT_CHANGE_EVENT,
        this.handleViewportChange
      );

      document.removeEventListener('mousemove', this.handleDocumentMouseMove);
      document.removeEventListener('mouseup', this.handleDocumentMouseUp);
      document.removeEventListener('mousedown', this.handleDocumentMouseDown);

      this.destroyXYGrid();
      this.destroyColorInput();
    }

    handleViewportChange = () => {
      if (this.activeXYWidget?.kind !== 'xy') return;

      this.requestGridPosition();
    };

    refreshDecorations() {
      this.decorations = buildValueDecorations(
        this.view,
        language,
        this.numberModifierActive,
        this.hoveredWidget
      );

      this.view.dispatch({});
      this.syncXYGrid();
    }

    setNumberModifierActive(active: boolean) {
      if (this.numberModifierActive === active) return false;

      this.numberModifierActive = active;
      this.refreshDecorations();

      return true;
    }

    setHoveredWidget(widget: InlineValueWidgetInfo | null) {
      if (sameWidget(this.hoveredWidget, widget)) return false;

      this.hoveredWidget = widget;
      this.refreshDecorations();

      return true;
    }

    setActiveXYWidget(widget: InlineValueWidgetInfo | null) {
      if (sameWidget(this.activeXYWidget, widget)) return false;

      this.activeXYWidget = widget;
      this.syncXYGrid();

      return true;
    }

    openColorPicker(widget: InlineValueWidgetInfo) {
      if (!widget.colorPicker) return false;

      this.destroyColorInput();

      const input = document.createElement('input');
      input.type = 'color';
      input.className = 'cm-value-widget-color-picker';
      input.value = hexColorForComponents(widget.components);
      input.dataset.valueWidgetFrom = String(widget.from);
      input.dataset.valueWidgetTo = String(widget.to);

      Object.assign(input.style, {
        position: 'fixed',
        width: '24px',
        height: '24px',
        opacity: '0',
        pointerEvents: 'none',
        zIndex: '10001'
      });

      input.addEventListener('input', this.handleColorInput);
      input.addEventListener('change', this.handleColorInput);
      input.addEventListener('blur', this.handleColorBlur);

      document.body.appendChild(input);
      this.colorInput = input;
      this.positionColorInput(widget, input);
      input.focus({ preventScroll: true });
      input.click();

      return true;
    }

    positionColorInput(widget: InlineValueWidgetInfo, input: HTMLInputElement) {
      const coords = this.view.coordsAtPos(widget.to);
      const margin = 8;

      if (!coords) {
        input.style.left = `${margin}px`;
        input.style.top = `${margin}px`;
        return;
      }

      input.style.left = `${Math.max(
        margin,
        Math.min(window.innerWidth - 24 - margin, coords.left)
      )}px`;
      input.style.top = `${Math.max(
        margin,
        Math.min(window.innerHeight - 24 - margin, coords.bottom + 8)
      )}px`;
    }

    destroyColorInput() {
      if (!this.colorInput) return;

      this.colorInput.removeEventListener('input', this.handleColorInput);
      this.colorInput.removeEventListener('change', this.handleColorInput);
      this.colorInput.removeEventListener('blur', this.handleColorBlur);
      this.colorInput.remove();
      this.colorInput = null;
    }

    handleColorBlur = () => {
      this.destroyColorInput();
    };

    handleColorInput = (event: Event) => {
      if (!(event.target instanceof HTMLInputElement)) return;

      const widget = findWidgetFromDataset(this.view.state, language, event.target, context);
      if (!widget || widget.kind !== 'color') return;

      this.applyColor(widget, event.target.value);
    };

    applyColor(widget: InlineValueWidgetInfo, hex: string) {
      const nextTexts = formatNormalizedColorComponents(widget.components, hex);
      if (!nextTexts) return false;

      const changes = widget.components.map((component, index) => ({
        from: component.from,
        to: component.to,
        insert: nextTexts[index]
      }));

      this.view.dispatch({ changes });
      dispatchValueWidgetChange(this.view);

      const nextWidget = updateVectorWidgetComponents(widget, nextTexts);
      this.hoveredWidget = nextWidget;
      this.refreshDecorations();

      return true;
    }

    syncXYGrid() {
      if (this.activeXYWidget?.kind !== 'xy') {
        this.destroyXYGrid();
        return;
      }

      if (!this.xyGrid) {
        this.xyGrid = createXYGridDom(this.activeXYWidget);
        this.xyGrid.addEventListener('mousedown', this.handleGridMouseDown);
        document.addEventListener('mousedown', this.handleDocumentMouseDown);
        document.body.appendChild(this.xyGrid);
      } else {
        this.xyGrid.replaceChildren(...createXYGridDom(this.activeXYWidget).childNodes);
        this.xyGrid.dataset.valueWidgetFrom = String(this.activeXYWidget.from);
        this.xyGrid.dataset.valueWidgetTo = String(this.activeXYWidget.to);
      }

      this.requestGridPosition();
    }

    requestGridPosition() {
      this.view.requestMeasure({
        key: this,
        read: (view): GridPosition | null => {
          if (!this.xyGrid || this.activeXYWidget?.kind !== 'xy') return null;

          const coords = view.coordsAtPos(this.activeXYWidget.to);
          if (!coords) return null;

          const gridWidth = 160;
          const gridHeight = 160;
          const margin = 8;

          return {
            left: Math.max(
              margin,
              Math.min(window.innerWidth - gridWidth - margin, coords.left - gridWidth / 2)
            ),
            top: Math.max(
              margin,
              Math.min(window.innerHeight - gridHeight - margin, coords.bottom + 8)
            )
          };
        },
        write: (position) => {
          if (!position || !this.xyGrid) return;

          this.xyGrid.style.left = `${position.left}px`;
          this.xyGrid.style.top = `${position.top}px`;
        }
      });
    }

    destroyXYGrid() {
      if (!this.xyGrid) return;

      this.xyGrid.removeEventListener('mousedown', this.handleGridMouseDown);
      document.removeEventListener('mousedown', this.handleDocumentMouseDown);

      this.xyGrid.remove();
      this.xyGrid = null;
    }

    handleGridMouseDown = (event: MouseEvent) => {
      this.startXYDrag(event);
    };

    startDocumentDragListeners() {
      document.addEventListener('mousemove', this.handleDocumentMouseMove);
      document.addEventListener('mouseup', this.handleDocumentMouseUp);
    }

    stopDocumentDragListeners() {
      document.removeEventListener('mousemove', this.handleDocumentMouseMove);
      document.removeEventListener('mouseup', this.handleDocumentMouseUp);
    }

    handleDocumentMouseDown = (event: MouseEvent) => {
      if (!this.xyGrid && !this.colorInput) return;

      if (
        isHTMLElement(event.target) &&
        event.target.closest('.cm-value-widget-xy-grid, .cm-value-widget-color-picker')
      ) {
        return;
      }

      const pos = this.view.posAtCoords({ x: event.clientX, y: event.clientY });
      const widget = pos === null ? null : findWidgetAtPos(this.view.state, language, pos, context);

      if (sameWidget(widget, this.activeXYWidget)) return;

      this.setActiveXYWidget(null);
      this.destroyColorInput();
    };

    updateHover(event: MouseEvent) {
      if (getWidgetDatasetTarget(event)) return false;

      if (!isActivationDrag(event)) {
        const modifierChanged = this.setNumberModifierActive(false);
        const hoverChanged = this.setHoveredWidget(null);

        return modifierChanged || hoverChanged;
      }

      this.setNumberModifierActive(true);

      const pos = this.view.posAtCoords({ x: event.clientX, y: event.clientY });
      const widget = pos === null ? null : findWidgetAtPos(this.view.state, language, pos, context);

      return this.setHoveredWidget(widget);
    }

    startDrag(event: MouseEvent) {
      if (isValueWidgetOverlayTarget(event)) {
        return this.startXYDrag(event);
      }

      if (!isActivationDrag(event)) return false;
      this.setNumberModifierActive(true);

      const pos = this.view.posAtCoords({ x: event.clientX, y: event.clientY });
      if (pos === null) return false;

      const widget = findWidgetAtPos(this.view.state, language, pos, context);

      if (!widget) return false;

      if (widget.kind !== 'number') {
        this.setHoveredWidget(widget);

        if (sameWidget(this.activeXYWidget, widget)) {
          this.setActiveXYWidget(null);
        } else if (widget.kind === 'xy') {
          this.setActiveXYWidget(widget);
        } else if (widget.kind === 'color') {
          this.openColorPicker(widget);
        }

        event.preventDefault();
        event.stopPropagation();

        return true;
      }

      const component = findNearestComponent(widget, pos);

      this.dragState = {
        kind: 'number',
        component,
        startY: event.clientY,
        startText: component.text
      };

      this.startDocumentDragListeners();

      this.view.focus();
      event.preventDefault();
      event.stopPropagation();

      return true;
    }

    startXYDrag(event: MouseEvent) {
      const widget = findWidgetFromDataset(
        this.view.state,
        language,
        getWidgetDatasetTarget(event),
        context
      );

      if (!widget || widget.kind !== 'xy') return false;

      const gridRect = this.xyGrid ? gridRectFromElement(this.xyGrid) : gridRectFromEvent(event);
      if (!gridRect) return false;

      this.dragState = { kind: 'xy', widget, gridRect };

      this.startDocumentDragListeners();
      this.updateXYDrag(event);

      event.preventDefault();
      event.stopPropagation();

      return true;
    }

    handleDocumentMouseMove = (event: MouseEvent) => {
      if (isHTMLElement(event.target) && this.view.dom.contains(event.target)) return;

      this.updateDrag(event);
    };

    handleDocumentMouseUp = (event: MouseEvent) => {
      this.endDrag(event);
    };

    updateDrag(event: MouseEvent) {
      if (!this.dragState) return false;

      if (this.dragState.kind === 'xy') {
        return this.updateXYDrag(event);
      }

      const delta = dragDeltaForNumber(
        this.dragState.startText,
        this.dragState.startY - event.clientY
      );

      const nextText = formatDraggedNumber(this.dragState.startText, delta);

      this.view.dispatch({
        changes: {
          from: this.dragState.component.from,
          to: this.dragState.component.to,
          insert: nextText
        }
      });

      dispatchValueWidgetChange(this.view);

      this.dragState.component = updateDraggedNumberComponent(this.dragState.component, nextText);

      event.preventDefault();
      event.stopPropagation();

      return true;
    }

    updateXYDrag(event: MouseEvent) {
      if (!this.dragState || this.dragState.kind !== 'xy') return false;

      const point = pointFromGridRect(event, this.dragState.gridRect);
      const [xComponent, yComponent] = this.dragState.widget.components;

      const nextX = formatNormalizedVectorComponent(xComponent.text, point.x);
      const nextY = formatNormalizedVectorComponent(yComponent.text, point.y);

      this.view.dispatch({
        changes: [
          {
            from: xComponent.from,
            to: xComponent.to,
            insert: nextX
          },
          {
            from: yComponent.from,
            to: yComponent.to,
            insert: nextY
          }
        ]
      });

      dispatchValueWidgetChange(this.view);

      this.dragState.widget = updateVectorWidgetComponents(this.dragState.widget, [nextX, nextY]);
      this.activeXYWidget = this.dragState.widget;
      this.hoveredWidget = this.dragState.widget;

      this.refreshDecorations();

      event.preventDefault();
      event.stopPropagation();

      return true;
    }

    endDrag(event: MouseEvent) {
      if (!this.dragState) return false;

      this.stopDocumentDragListeners();
      this.dragState = null;

      event.preventDefault();
      event.stopPropagation();

      return true;
    }
  }

  const plugin: ViewPlugin<InlineValuePluginValue> = ViewPlugin.fromClass(InlineValuePluginValue, {
    decorations: (pluginValue) => pluginValue.decorations,
    eventHandlers: {
      keydown(event, view) {
        if (!isActivationKey(event)) return false;

        view.plugin(plugin)?.setNumberModifierActive(true);

        return false;
      },
      keyup(event, view) {
        if (!isActivationKey(event)) return false;

        view.plugin(plugin)?.setNumberModifierActive(false);

        return false;
      },
      blur(_event, view) {
        const pluginValue = view.plugin(plugin);
        if (!pluginValue) return false;

        const modifierChanged = pluginValue.setNumberModifierActive(false);
        const hoverChanged = pluginValue.setHoveredWidget(null);

        return modifierChanged || hoverChanged;
      },
      mousedown(event, view) {
        return view.plugin(plugin)?.startDrag(event) ?? false;
      },
      mousemove(event, view) {
        const pluginValue = view.plugin(plugin);
        if (!pluginValue) return false;

        if (pluginValue.updateDrag(event)) return true;

        pluginValue.updateHover(event);

        return false;
      },
      mouseup(event, view) {
        return view.plugin(plugin)?.endDrag(event) ?? false;
      },
      mouseleave(_event, view) {
        if (view.plugin(plugin)?.numberModifierActive) return false;

        view.plugin(plugin)?.setHoveredWidget(null);
        return false;
      }
    }
  });

  return [
    plugin,
    EditorView.baseTheme({
      '.cm-value-widget': {
        position: 'relative',
        display: 'inline-block',
        width: '0.75em',
        height: '0.75em',
        marginLeft: '0.35em',
        verticalAlign: '-0.08em',
        border: '1px solid rgba(212, 212, 216, 0.55)',
        borderRadius: '2px',
        boxSizing: 'border-box',
        cursor: 'ns-resize',
        opacity: '0.78'
      },
      '.cm-value-widget-number-active': {
        textDecoration: 'underline',
        textDecorationColor: 'rgba(147, 197, 253, 0.95)',
        textDecorationThickness: '2px',
        textUnderlineOffset: '3px',
        cursor: 'ns-resize'
      },
      '.cm-value-widget-active': {
        textDecoration: 'underline',
        textDecorationColor: 'rgba(147, 197, 253, 0.95)',
        textDecorationThickness: '2px',
        textUnderlineOffset: '3px',
        backgroundColor: 'rgba(147, 197, 253, 0.12)',
        borderRadius: '2px',
        cursor: 'crosshair'
      },
      '.cm-value-widget-xy': {
        background:
          'linear-gradient(90deg, transparent 45%, rgba(147, 197, 253, 0.9) 45%, rgba(147, 197, 253, 0.9) 55%, transparent 55%), linear-gradient(0deg, transparent 45%, rgba(147, 197, 253, 0.9) 45%, rgba(147, 197, 253, 0.9) 55%, transparent 55%)'
      },
      '.cm-value-widget-color': {
        borderColor: 'rgba(244, 244, 245, 0.8)',
        cursor: 'pointer'
      },
      '.cm-value-widget-xy-grid': {
        position: 'absolute',
        zIndex: '50',
        left: '50%',
        top: '1.1em',
        width: '160px',
        height: '160px',
        transform: 'translateX(-50%)',
        border: '1px solid rgba(161, 161, 170, 0.9)',
        backgroundColor: 'rgba(24, 24, 27, 0.96)',
        backgroundImage:
          'linear-gradient(rgba(161, 161, 170, 0.24) 1px, transparent 1px), linear-gradient(90deg, rgba(161, 161, 170, 0.24) 1px, transparent 1px), linear-gradient(rgba(244, 244, 245, 0.42) 1px, transparent 1px), linear-gradient(90deg, rgba(244, 244, 245, 0.42) 1px, transparent 1px)',
        backgroundSize: '16px 16px, 16px 16px, 80px 80px, 80px 80px',
        boxShadow: '0 10px 28px rgba(0, 0, 0, 0.45)',
        cursor: 'crosshair'
      },
      '.cm-value-widget-xy-dot': {
        position: 'absolute',
        width: '8px',
        height: '8px',
        borderRadius: '999px',
        backgroundColor: 'rgb(244, 244, 245)',
        border: '1px solid rgb(9, 9, 11)',
        transform: 'translate(-50%, -50%)',
        pointerEvents: 'none'
      }
    })
  ];
}
