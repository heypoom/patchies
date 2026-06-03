import type { EditorState } from '@codemirror/state';
import type { EditorView } from '@codemirror/view';
import { VALUE_WIDGET_CHANGE_EVENT } from '$lib/codemirror/value-widget-events';
import { findInlineValueWidgets } from './detection';
import type {
  InlineValueWidgetContext,
  InlineValueWidgetInfo,
  InlineValueWidgetLanguage
} from './types';

export const isActivationDrag = (event: MouseEvent) =>
  navigator.platform.toLowerCase().includes('mac') ? event.altKey : event.ctrlKey;

export const isActivationKey = (event: KeyboardEvent) =>
  navigator.platform.toLowerCase().includes('mac') ? event.key === 'Alt' : event.key === 'Control';

export function findNearestComponent(widget: InlineValueWidgetInfo, pos: number) {
  return (
    widget.components.find((component) => pos >= component.from && pos <= component.to) ??
    widget.components[0]
  );
}

export function sameWidget(a: InlineValueWidgetInfo | null, b: InlineValueWidgetInfo | null) {
  return a?.from === b?.from && a?.to === b?.to && a?.kind === b?.kind;
}

export function findWidgetAtPos(
  state: EditorState,
  language: InlineValueWidgetLanguage,
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

export function isHTMLElement(value: EventTarget | null): value is HTMLElement {
  return value instanceof HTMLElement;
}

export function getWidgetDatasetTarget(event: MouseEvent) {
  if (!isHTMLElement(event.target)) return null;

  return event.target.closest<HTMLElement>(
    '.cm-value-widget, .cm-value-widget-xy-grid, .cm-value-widget-color-picker'
  );
}

export function isValueWidgetOverlayTarget(event: MouseEvent) {
  if (!isHTMLElement(event.target)) return false;

  return !!event.target.closest('.cm-value-widget-xy-grid, .cm-value-widget-color-picker');
}

export function findWidgetFromDataset(
  state: EditorState,
  language: InlineValueWidgetLanguage,
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

export function dispatchValueWidgetChange(view: EditorView) {
  view.dom.dispatchEvent(
    new CustomEvent<{ value: string }>(VALUE_WIDGET_CHANGE_EVENT, {
      detail: { value: view.state.doc.toString() },
      bubbles: true
    })
  );
}
