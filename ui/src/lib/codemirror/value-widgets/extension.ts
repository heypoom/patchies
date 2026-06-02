import { syntaxTree } from '@codemirror/language';
import type { Extension } from '@codemirror/state';
import { RangeSetBuilder } from '@codemirror/state';
import {
  Decoration,
  ViewPlugin,
  type DecorationSet,
  type EditorView,
  type PluginValue,
  type ViewUpdate
} from '@codemirror/view';
import { VALUE_WIDGET_VIEWPORT_CHANGE_EVENT } from '$lib/codemirror/value-widget-events';
import { findInlineValueWidgets } from './detection';
import {
  dispatchValueWidgetChange,
  findNearestComponent,
  findWidgetAtPos,
  findWidgetFromDataset,
  getWidgetDatasetTarget,
  isActivationDrag,
  isActivationKey,
  isHTMLElement,
  isValueWidgetOverlayTarget,
  sameWidget
} from './dom-events';
import { valueWidgetsTheme } from './theme';
import type {
  GridPosition,
  InlineValueComponent,
  InlineValueWidgetContext,
  InlineValueWidgetInfo,
  InlineValueWidgetLanguage,
  VectorComponentTexts
} from './types';
import {
  formatNormalizedColorComponents,
  hexColorForComponents,
  ValueCueWidget
} from './widgets/color-widget';
import {
  dragDeltaForNumber,
  formatDraggedNumber,
  formatNormalizedVectorComponent,
  updateDraggedNumberComponent
} from './widgets/number-widget';
import {
  createXYGridDom,
  gridRectFromElement,
  gridRectFromEvent,
  pointFromGridRect
} from './widgets/xy-widget';

function buildValueDecorations(
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
  gridRect: {
    left: number;
    top: number;
    width: number;
    height: number;
  };
}

type ActiveDragState = DragState | XYDragState;

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
  language: InlineValueWidgetLanguage,
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
      this.decorations = buildValueDecorations(this.numberModifierActive, this.hoveredWidget);

      view.dom.addEventListener(VALUE_WIDGET_VIEWPORT_CHANGE_EVENT, this.handleViewportChange);
    }

    update(update: ViewUpdate) {
      if (
        update.docChanged ||
        update.viewportChanged ||
        syntaxTree(update.startState) !== syntaxTree(update.state)
      ) {
        this.decorations = buildValueDecorations(this.numberModifierActive, this.hoveredWidget);
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
      this.decorations = buildValueDecorations(this.numberModifierActive, this.hoveredWidget);

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

  return [plugin, valueWidgetsTheme];
}
