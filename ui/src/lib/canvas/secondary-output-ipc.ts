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

export function dispatchOutputToMainMessage(
  message: OutputToMainMessage,
  sink: OutputSurfaceInputSink | null
): void {
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

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
