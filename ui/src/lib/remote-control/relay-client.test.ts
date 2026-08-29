import { afterEach, describe, expect, it, vi } from 'vitest';
import { RemoteControlRelayClient } from './relay-client';

describe('RemoteControlRelayClient', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('adds a bounded abort signal to JSON requests', async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchMock);
    const relay = new RemoteControlRelayClient('http://patchies.test', () => ({
      sessionId: 'session-1',
      secret: 'secret-1'
    }));

    await relay.request('/api/remote-control/sessions/session-1/commits', {
      method: 'POST',
      body: { commitId: 'commit-1' }
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'http://patchies.test/api/remote-control/sessions/session-1/commits',
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    );
  });
});
