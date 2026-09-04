import { RemoteControlRequestError, type SessionCredentials } from './remote-control-types';

const requestTimeout = 30_000;

interface RequestInit {
  method: string;
  body?: unknown;
  signal?: AbortSignal;
}

export class RemoteControlRelayClient {
  constructor(
    private readonly instanceURL: string,
    private readonly credentials: () => SessionCredentials | null
  ) {}

  async request<T = void>(path: string, init: RequestInit): Promise<T> {
    const response = await fetch(`${this.instanceURL}${path}`, {
      method: init.method,
      headers: { ...this.headers(), 'Content-Type': 'application/json' },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      signal: init.signal ?? AbortSignal.timeout(requestTimeout)
    });

    if (!response.ok) throw await responseError(response);
    if (response.status === 204) return undefined as T;

    return (await response.json()) as T;
  }

  async openBrowserEvents(
    sessionId: string,
    afterEventID: number,
    signal: AbortSignal
  ): Promise<ReadableStreamDefaultReader<string>> {
    const headers = new Headers(this.headers());
    if (afterEventID > 0) headers.set('Last-Event-ID', String(afterEventID));

    const response = await fetch(
      `${this.instanceURL}/api/remote-control/sessions/${sessionId}/browser/events`,
      { headers, signal }
    );

    if (!response.ok || !response.body) throw await responseError(response);

    return response.body.pipeThrough(new TextDecoderStream()).getReader();
  }

  private headers(): HeadersInit {
    const credentials = this.credentials();

    return credentials ? { Authorization: `Bearer ${credentials.secret}` } : {};
  }
}

const responseError = async (response: Response): Promise<RemoteControlRequestError> => {
  try {
    const body = (await response.json()) as { code?: string };

    return new RemoteControlRequestError(response.status, body.code);
  } catch {
    return new RemoteControlRequestError(response.status);
  }
};
