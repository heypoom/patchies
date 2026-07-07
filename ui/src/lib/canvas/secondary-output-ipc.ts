import hljs from 'highlight.js/lib/core';
import glsl from 'highlight.js/lib/languages/glsl';
import javascript from 'highlight.js/lib/languages/javascript';
import markdown from 'highlight.js/lib/languages/markdown';
import plaintext from 'highlight.js/lib/languages/plaintext';
import python from 'highlight.js/lib/languages/python';
import ruby from 'highlight.js/lib/languages/ruby';
import wasm from 'highlight.js/lib/languages/wasm';
import x86asm from 'highlight.js/lib/languages/x86asm';
import type { SupportedLanguage } from '$lib/codemirror/types';
import { isFiniteNumber, isRecord } from '$lib/utils/value-guards';
import type { CodeEditorTarget } from '../../stores/code-editor-layout.store';
import type { PointerEvent_, SurfaceWheelEvent_, TouchPoint } from './SurfaceListeners';

hljs.registerLanguage('glsl', glsl);
hljs.registerLanguage('javascript', javascript);
hljs.registerLanguage('markdown', markdown);
hljs.registerLanguage('plain', plaintext);
hljs.registerLanguage('python', python);
hljs.registerLanguage('ruby', ruby);
hljs.registerLanguage('wasm', wasm);
hljs.registerLanguage('x86asm', x86asm);

const HIGHLIGHT_LANGUAGE_BY_EDITOR_LANGUAGE: Partial<Record<SupportedLanguage, string>> = {
  assembly: 'x86asm',
  glsl: 'glsl',
  javascript: 'javascript',
  markdown: 'markdown',
  plain: 'plain',
  python: 'python',
  ruby: 'ruby',
  wgsl: 'glsl'
};

export type CodeOverlayMirrorState = {
  nodeId: string;
  dataKey: string;
  value: string;
  language: SupportedLanguage;
  nodeType?: string;
  title?: string;
  fontSizePx: number;
  transparency: number;
};

export type SurfaceOverlayMirrorState = {
  active: boolean;
};

export type MainToOutputMessage =
  | { type: 'renderOutput'; bitmap: ImageBitmap }
  | { type: 'codeOverlayState'; state: CodeOverlayMirrorState | null }
  | { type: 'surfaceOverlayState'; state: SurfaceOverlayMirrorState | null }
  | { type: 'surfaceOverlayFrame'; bitmap: ImageBitmap };

export type OutputToMainMessage =
  | { type: 'outputReady' }
  | { type: 'outputSurfacePointer'; event: PointerEvent_ }
  | { type: 'outputSurfaceWheel'; event: SurfaceWheelEvent_ }
  | { type: 'outputSurfaceTouch'; touches: TouchPoint[] }
  | { type: 'outputSurfaceLeave' };

export type OutputSurfaceInputSink = {
  pointer(event: PointerEvent_): void;
  wheel(event: SurfaceWheelEvent_): void;
  touch(touches: TouchPoint[]): void;
  leave(): void;
};

export function createCodeOverlayMirrorState(
  target: CodeEditorTarget | null,
  value: string,
  fontSizePx: number,
  transparency: number
): CodeOverlayMirrorState | null {
  if (target?.mode !== 'overlay') return null;

  return {
    nodeId: target.nodeId,
    dataKey: target.dataKey,
    value,
    language: target.language,
    nodeType: target.nodeType,
    title: target.title,
    fontSizePx,
    transparency
  };
}

export const createDetachedStrudelCodeOverlayMirrorState = (
  nodeId: string,
  value: string,
  fontSizePx: number,
  transparency: number
): CodeOverlayMirrorState => ({
  nodeId,
  dataKey: 'code',
  value,
  language: 'javascript',
  nodeType: 'strudel',
  title: 'strudel',
  fontSizePx,
  transparency
});

export function dispatchOutputToMainMessage(
  message: unknown,
  sink: OutputSurfaceInputSink | null
): void {
  if (!isOutputToMainMessage(message)) return;
  if (!sink) return;

  if (message.type === 'outputSurfacePointer') {
    sink.pointer(message.event);
  } else if (message.type === 'outputSurfaceWheel') {
    sink.wheel(message.event);
  } else if (message.type === 'outputSurfaceTouch') {
    sink.touch(message.touches);
  } else if (message.type === 'outputSurfaceLeave') {
    sink.leave();
  }
}

export function isMainToOutputMessage(message: unknown): message is MainToOutputMessage {
  if (!isRecord(message) || typeof message.type !== 'string') return false;

  if (message.type === 'renderOutput' || message.type === 'surfaceOverlayFrame') {
    return isImageBitmapLike(message.bitmap);
  }

  if (message.type === 'codeOverlayState') {
    return message.state === null || isCodeOverlayMirrorState(message.state);
  }

  if (message.type === 'surfaceOverlayState') {
    return message.state === null || isSurfaceOverlayMirrorState(message.state);
  }

  return false;
}

export function isOutputToMainMessage(message: unknown): message is OutputToMainMessage {
  if (!isRecord(message) || typeof message.type !== 'string') return false;

  if (message.type === 'outputReady' || message.type === 'outputSurfaceLeave') {
    return true;
  }

  if (message.type === 'outputSurfacePointer') {
    return isPointerEventPayload(message.event);
  }

  if (message.type === 'outputSurfaceWheel') {
    return isWheelEventPayload(message.event);
  }

  if (message.type === 'outputSurfaceTouch') {
    return Array.isArray(message.touches) && message.touches.every(isTouchPointPayload);
  }

  return false;
}

export function highlightCodeOverlayValue(value: string, language: SupportedLanguage): string {
  const highlightLanguage = HIGHLIGHT_LANGUAGE_BY_EDITOR_LANGUAGE[language];

  if (!highlightLanguage || !hljs.getLanguage(highlightLanguage)) {
    return escapeHtml(value);
  }

  return hljs.highlight(value, { language: highlightLanguage, ignoreIllegals: true }).value;
}

export function syncCanvasSizeToBitmap(canvas: HTMLCanvasElement, bitmap: ImageBitmap): void {
  if (canvas.width !== bitmap.width) {
    canvas.width = bitmap.width;
  }

  if (canvas.height !== bitmap.height) {
    canvas.height = bitmap.height;
  }
}

export const hasConnectedOutputWindow = (
  outputWindow: Pick<Window, 'closed'> | null | undefined
): boolean => outputWindow !== null && outputWindow !== undefined && !outputWindow.closed;

const escapeHtml = (value: string): string =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

const isOptionalString = (value: unknown): value is string | undefined =>
  value === undefined || typeof value === 'string';

const isImageBitmapLike = (value: unknown): value is ImageBitmap =>
  isRecord(value) &&
  isFiniteNumber(value.width) &&
  isFiniteNumber(value.height) &&
  typeof value.close === 'function';

const isCodeOverlayMirrorState = (value: unknown): value is CodeOverlayMirrorState =>
  isRecord(value) &&
  typeof value.nodeId === 'string' &&
  typeof value.dataKey === 'string' &&
  typeof value.value === 'string' &&
  typeof value.language === 'string' &&
  isOptionalString(value.nodeType) &&
  isOptionalString(value.title) &&
  isFiniteNumber(value.fontSizePx) &&
  isFiniteNumber(value.transparency);

const isSurfaceOverlayMirrorState = (value: unknown): value is SurfaceOverlayMirrorState =>
  isRecord(value) && typeof value.active === 'boolean';

const isPointerEventPayload = (value: unknown): value is PointerEvent_ =>
  isRecord(value) &&
  isFiniteNumber(value.x) &&
  isFiniteNumber(value.y) &&
  isFiniteNumber(value.pressure) &&
  isFiniteNumber(value.buttons) &&
  typeof value.down === 'boolean' &&
  typeof value.type === 'string';

const isWheelEventPayload = (value: unknown): value is SurfaceWheelEvent_ =>
  isRecord(value) &&
  isFiniteNumber(value.x) &&
  isFiniteNumber(value.y) &&
  isFiniteNumber(value.deltaX) &&
  isFiniteNumber(value.deltaY) &&
  isFiniteNumber(value.deltaMode);

const isTouchPointPayload = (value: unknown): value is TouchPoint =>
  isRecord(value) &&
  isFiniteNumber(value.id) &&
  isFiniteNumber(value.x) &&
  isFiniteNumber(value.y) &&
  isFiniteNumber(value.pressure);
