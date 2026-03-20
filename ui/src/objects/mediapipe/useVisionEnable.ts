/**
 * Shared enable/disable hook for vision nodes.
 * Creates a MessageContext and handles bang/boolean/number messages
 * to enable or disable the node via MediaPipeNodeSystem.
 */

import { match, P } from 'ts-pattern';
import { MessageContext } from '$lib/messages/MessageContext';
import { messages } from '$lib/objects/schemas/common';
import { MediaPipeNodeSystem } from './MediaPipeNodeSystem';

export function useVisionEnable(
  nodeId: string,
  getEnabled: () => boolean
): {
  messageContext: MessageContext;
  destroy: () => void;
} {
  const mediaPipeSystem = MediaPipeNodeSystem.getInstance();

  function handleMessage(msg: unknown) {
    match(msg)
      .with(messages.bang, () => mediaPipeSystem.setEnabled(nodeId, !getEnabled()))
      .with(P.boolean, (v) => mediaPipeSystem.setEnabled(nodeId, v))
      .with(P.number, (v) => mediaPipeSystem.setEnabled(nodeId, v !== 0))
      .otherwise(() => {});
  }

  const messageContext = new MessageContext(nodeId);

  messageContext.queue.addCallback(handleMessage);

  return {
    messageContext,

    destroy() {
      messageContext.queue.removeCallback(handleMessage);
      messageContext.destroy();
    }
  };
}
