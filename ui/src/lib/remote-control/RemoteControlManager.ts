import { P2PManager } from '$lib/p2p/P2PManager';
import type { RemoteChatToolAdapter, RemoteToolRequest } from './RemoteChatToolAdapter';

const CHANNEL = '__remote-control';

interface RemoteControlRequestMessage extends RemoteToolRequest {
  type: 'request';
  id: string;
  capability: string;
}

interface RemoteControlResponseMessage {
  type: 'response';
  id: string;
  result: Awaited<ReturnType<RemoteChatToolAdapter['handle']>>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function isRequestMessage(value: unknown): value is RemoteControlRequestMessage {
  return (
    isRecord(value) &&
    value.type === 'request' &&
    typeof value.id === 'string' &&
    typeof value.capability === 'string' &&
    typeof value.tool === 'string' &&
    isRecord(value.args)
  );
}

class RemoteControlManager {
  private capability: string | null = null;
  private adapter: RemoteChatToolAdapter | null = null;
  private unsubscribe: (() => void) | null = null;

  async enable(capability: string, adapter: RemoteChatToolAdapter): Promise<void> {
    this.capability = capability;
    this.adapter = adapter;

    if (this.unsubscribe) return;

    const p2p = P2PManager.getInstance();
    await p2p.initialize();

    if (this.capability !== capability || this.unsubscribe) return;

    this.unsubscribe = p2p.subscribeToChannel(CHANNEL, (data, peerId) => {
      void this.handleMessage(data, peerId);
    });

    console.info('[remote-control] Enabled');
  }

  disable(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
    this.capability = null;
    this.adapter = null;
    console.info('[remote-control] Disabled');
  }

  private async handleMessage(data: unknown, peerId: string): Promise<void> {
    if (!isRequestMessage(data) || !this.capability || !this.adapter) return;
    if (data.capability !== this.capability) {
      console.warn('[remote-control] Rejected request with an invalid capability');
      return;
    }

    const result = await this.adapter.handle({ tool: data.tool, args: data.args });
    const response: RemoteControlResponseMessage = { type: 'response', id: data.id, result };

    P2PManager.getInstance().sendToPeerOnChannel(CHANNEL, peerId, response);
  }
}

export const remoteControlManager = new RemoteControlManager();
