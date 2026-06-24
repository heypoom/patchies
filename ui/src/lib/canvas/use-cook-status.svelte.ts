import { PatchiesEventBus } from '$lib/eventbus/PatchiesEventBus';
import type { CookStatusUpdateEvent } from '$lib/eventbus/events';
import type { RenderCookStatus } from '$lib/rendering/types';

/**
 * Tracks worker-reported cook status for a render node.
 * Returns a reactive `status` getter.
 */
export function useCookStatus(
  nodeId: string | undefined | (() => string | undefined),
  enabled: boolean | (() => boolean) = true
) {
  let status = $state<RenderCookStatus | undefined>(undefined);

  $effect(() => {
    if (!getValue(enabled)) {
      status = undefined;
      return;
    }

    const currentNodeId = getValue(nodeId);

    if (!currentNodeId) {
      status = undefined;
      return;
    }

    const eventBus = PatchiesEventBus.getInstance();

    const handle = (event: CookStatusUpdateEvent) => {
      if (event.nodeId !== currentNodeId) return;

      status = {
        status: event.status,
        cookedFrames: event.cookedFrames,
        cachedFrames: event.cachedFrames,
        lastCookTimeMs: event.lastCookTimeMs,
        lastCookReasons: event.lastCookReasons
      };
    };

    eventBus.addEventListener('cookStatus', handle);

    return () => eventBus.removeEventListener('cookStatus', handle);
  });

  return {
    get status() {
      return status;
    }
  };
}

const getValue = <T>(value: T | (() => T)): T =>
  typeof value === 'function' ? (value as () => T)() : value;
