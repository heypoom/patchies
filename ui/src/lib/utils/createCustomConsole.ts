import { logger } from '$lib/utils/logger';

/**
 * Creates a custom console object that routes output to VirtualConsole via logger.
 * Used by JS-executing nodes (js, p5, tone~, etc.) to capture console.* calls.
 */
export function createCustomConsole(nodeId: string) {
  const nodeLogger = logger.ofNode(nodeId);

  return {
    log: (...args: unknown[]) => nodeLogger.log(...args),
    error: (...args: unknown[]) => nodeLogger.error(...args),
    warn: (...args: unknown[]) => nodeLogger.warn(...args),
    debug: (...args: unknown[]) => nodeLogger.debug(...args),
    info: (...args: unknown[]) => nodeLogger.info(...args)
  };
}

export type CustomConsole = ReturnType<typeof createCustomConsole>;
