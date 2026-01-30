import { logger } from '$lib/utils/logger';
import { parseJSError, countLines } from '$lib/js-runner/js-error-parser';

type CustomConsole = {
  error: (...args: unknown[]) => void;
};

/**
 * Handles code execution errors with line number extraction and logging.
 * Used by nodes that execute user JavaScript code (js, p5, tone~, sonic~, elem~).
 *
 * @param error The caught error
 * @param code The user's code string (for line counting)
 * @param nodeId The node ID for logging
 * @param customConsole Console object for fallback error logging
 * @param wrapperOffset Additional offset for line number correction (node-specific)
 */
export function handleCodeError(
  error: unknown,
  code: string,
  nodeId: string,
  customConsole: CustomConsole,
  wrapperOffset: number = 0
): void {
  const errorInfo = parseJSError(error, countLines(code), wrapperOffset);

  if (errorInfo) {
    logger.nodeError(nodeId, { lineErrors: errorInfo.lineErrors }, errorInfo.message);
    return;
  }

  const errorMessage = error instanceof Error ? error.message : String(error);
  customConsole.error(errorMessage);
}
