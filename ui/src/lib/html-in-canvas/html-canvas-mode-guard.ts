export type HtmlCanvasMode = 'videoOutput' | 'canvasLayer' | 'glslLayer';

export type HtmlCanvasModeGuardResult =
  | { ok: true; mode: HtmlCanvasMode }
  | { ok: false; message: string };

export function guardHtmlCanvasMode({
  currentMode,
  requestedMode,
  videoOutputEnabled
}: {
  currentMode: HtmlCanvasMode | null;
  requestedMode: HtmlCanvasMode;
  videoOutputEnabled: boolean;
}): HtmlCanvasModeGuardResult {
  if (requestedMode !== 'videoOutput' && videoOutputEnabled) {
    return {
      ok: false,
      message: `htmlCanvas.${requestedMode}() cannot be used while htmlCanvas.videoOutput() is enabled. Call htmlCanvas.videoOutput(false) before enabling a local layer.`
    };
  }

  if (currentMode === null || currentMode === requestedMode) {
    return { ok: true, mode: requestedMode };
  }

  return {
    ok: false,
    message: `htmlCanvas.${requestedMode}() cannot be used with htmlCanvas.${currentMode}() in the same run. Choose one of htmlCanvas.videoOutput(), htmlCanvas.canvasLayer(), or htmlCanvas.glslLayer().`
  };
}
