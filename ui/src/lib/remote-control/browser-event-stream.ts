import { RemoteControlRequestError } from './remote-control-types';

const reconnectDelay = 500;

export interface BrowserEvent {
  id: number;
  type?: string;
  data?: string;
}

interface BrowserEventStreamOptions {
  open: (afterEventID: number, signal: AbortSignal) => Promise<ReadableStreamDefaultReader<string>>;
  onEvent: (event: BrowserEvent) => Promise<void>;
  onSessionNotFound: () => void;
}

export class BrowserEventStream {
  private abortController: AbortController | null = null;
  private eventCursor = 0;

  constructor(private readonly options: BrowserEventStreamOptions) {}

  start(): void {
    this.stop();
    this.eventCursor = 0;

    const controller = new AbortController();
    this.abortController = controller;

    this.run(controller.signal);
  }

  stop(): void {
    this.abortController?.abort();
    this.abortController = null;
  }

  private async run(signal: AbortSignal): Promise<void> {
    while (!signal.aborted) {
      try {
        await this.consume(signal);
      } catch (error) {
        if (signal.aborted) return;

        if (error instanceof RemoteControlRequestError) {
          if (error.code === 'session_not_found') {
            this.options.onSessionNotFound();
            return;
          }

          if (error.code === 'replay_unavailable') {
            this.eventCursor = 0;
          }
        }

        console.error('Remote control browser stream stopped; reconnecting', error);
      }

      await wait(reconnectDelay, signal);
    }
  }

  private async consume(signal: AbortSignal): Promise<void> {
    const reader = await this.options.open(this.eventCursor, signal);
    let pending = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) return;

      pending += value;

      const events = pending.split('\n\n');
      pending = events.pop() ?? '';

      for (const rawEvent of events) {
        const event = parseEvent(rawEvent);
        await this.options.onEvent(event);

        if (Number.isSafeInteger(event.id) && event.id > this.eventCursor) {
          this.eventCursor = event.id;
        }
      }
    }
  }
}

const parseEvent = (rawEvent: string): BrowserEvent => ({
  id: Number(rawEvent.match(/^id: (.+)$/m)?.[1] ?? 0),
  type: rawEvent.match(/^event: (.+)$/m)?.[1],
  data: rawEvent.match(/^data: (.+)$/m)?.[1]
});

const wait = (milliseconds: number, signal: AbortSignal): Promise<void> =>
  new Promise((resolve) => {
    if (signal.aborted) {
      resolve();
      return;
    }

    const finish = () => {
      clearTimeout(timeout);
      signal.removeEventListener('abort', finish);
      resolve();
    };

    const timeout = setTimeout(finish, milliseconds);
    signal.addEventListener('abort', finish, { once: true });
  });
