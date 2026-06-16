import { logger } from '$lib/utils/logger';

type DestroyWorkletNodeOptions = {
  label: string;
  node: AudioWorkletNode;
  fallbackCloseMs?: number;
};

export function destroyWorkletNode({
  label,
  node,
  fallbackCloseMs = 250
}: DestroyWorkletNodeOptions): void {
  const port = node.port;
  let fallbackCloseTimer: ReturnType<typeof setTimeout> | null = null;

  const closePort = () => {
    if (fallbackCloseTimer !== null) {
      clearTimeout(fallbackCloseTimer);
      fallbackCloseTimer = null;
    }

    try {
      port.onmessage = null;
      port.close?.();
    } catch (error) {
      logger.warn(`cannot close ${label} worklet port:`, error);
    }
  };

  try {
    port.onmessage = (event: MessageEvent<{ type?: string }>) => {
      if (event.data?.type === 'stopped') {
        closePort();
      }
    };

    port.postMessage({ type: 'stop' });
    fallbackCloseTimer = setTimeout(closePort, fallbackCloseMs);
  } catch (error) {
    logger.warn(`cannot stop ${label} worklet:`, error);
    closePort();
  }

  try {
    node.disconnect();
  } catch (error) {
    logger.warn(`cannot disconnect ${label} worklet:`, error);
  }
}
