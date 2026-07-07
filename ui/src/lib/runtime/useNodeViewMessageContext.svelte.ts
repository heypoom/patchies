import { onMount } from 'svelte';
import { MessageContext } from '$lib/messages/MessageContext';
import type { MessageCallbackFn } from '$lib/messages/MessageSystem';

export function useNodeViewMessageContext(nodeId: string, onMessage: MessageCallbackFn) {
  let messageContext = $state<MessageContext | null>(null);

  onMount(() => {
    messageContext = new MessageContext(nodeId);
    messageContext.messageCallbacks = [onMessage];

    return () => {
      messageContext?.destroy({ unregisterNode: false });
      messageContext = null;
    };
  });

  return {
    send(data: unknown): void {
      messageContext?.queue.sendMessage({ data, source: nodeId });
    }
  };
}
