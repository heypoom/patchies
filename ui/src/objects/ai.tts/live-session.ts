interface LiveSessionOptions {
  url: string;
  apiKey: string;
  model: string;
  voice: string;
  onAudio: (chunk: Uint8Array<ArrayBuffer>) => Promise<void>;
  onDone: () => Promise<void>;
  onError: (message: string) => void;
}

type LiveCommand = { type: 'text'; text: string } | { type: 'flush' | 'end' };

export const getPaxaRelayURL = (origin: string) => {
  const url = new URL('/api/ai/tts/paxa/live', origin);
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';

  return url.toString();
};

/** One incremental text turn, with ordered MP3 delivery through the relay. */
export class PaxaLiveSession {
  private readonly socket: WebSocket;
  private readonly pending: LiveCommand[] = [];

  private audioQueue = Promise.resolve();
  private ready = false;
  private closed = false;
  private receivedDone = false;
  private ending = false;
  private readonly timeout: ReturnType<typeof setTimeout>;

  get acceptsText() {
    return !this.closed && !this.ending;
  }

  constructor(private readonly options: LiveSessionOptions) {
    this.socket = new WebSocket(options.url);
    this.socket.binaryType = 'arraybuffer';

    this.timeout = setTimeout(() => {
      this.fail('Paxa live connection timed out.');
    }, 20_000);

    // Retain credentials only until the first relay message has been sent.
    let apiKey = options.apiKey;
    options.apiKey = '';

    this.socket.onopen = () => {
      if (this.closed) return;

      this.socket.send(JSON.stringify({ type: 'auth', apiKey }));
      apiKey = '';
    };

    this.socket.onmessage = (event) => this.receive(event.data);

    this.socket.onerror = () => {
      this.fail('Could not connect to Paxa live speech. Check that the Go server is running.');
    };

    this.socket.onclose = () => {
      if (!this.closed && !this.receivedDone) {
        this.fail('Paxa live connection closed before speech finished.');
      }
    };
  }

  append(text: string) {
    if (text && this.acceptsText) this.send({ type: 'text', text });
  }

  flush() {
    if (this.acceptsText) this.send({ type: 'flush' });
  }

  end() {
    if (!this.acceptsText) return;

    this.ending = true;
    this.send({ type: 'end' });
  }

  stop() {
    if (this.closed) return;

    this.closed = true;
    clearTimeout(this.timeout);

    this.pending.length = 0;
    this.socket.close();
  }

  private send(command: LiveCommand) {
    if (this.ready) {
      this.socket.send(JSON.stringify(command));
    } else {
      this.pending.push(command);
    }
  }

  private receive(data: unknown) {
    if (this.closed) return;

    if (data instanceof ArrayBuffer) {
      this.audioQueue = this.audioQueue
        .then(async () => {
          if (!this.closed) await this.options.onAudio(new Uint8Array(data));
        })
        .catch((error) =>
          this.fail(error instanceof Error ? error.message : 'Streamed speech playback failed.')
        );

      return;
    }

    try {
      const event = JSON.parse(String(data));

      if (event.type === 'relayReady') {
        this.socket.send(
          JSON.stringify({
            type: 'start',
            model: this.options.model,
            voice: this.options.voice,
            format: 'mp3'
          })
        );
      } else if (event.type === 'started') {
        clearTimeout(this.timeout);
        this.ready = true;

        for (const command of this.pending.splice(0)) {
          this.send(command);
        }
      } else if (event.type === 'error') {
        const code = typeof event.code === 'string' ? event.code : 'unknown_error';

        this.fail(`Paxa live: ${code}`);
      } else if (event.type === 'done') {
        this.receivedDone = true;
        this.ending = true;

        clearTimeout(this.timeout);

        this.audioQueue = this.audioQueue
          .then(async () => {
            if (this.closed) return;

            await this.options.onDone();
            this.stop();
          })
          .catch((error) =>
            this.fail(error instanceof Error ? error.message : 'Streamed speech playback failed.')
          );
      }
    } catch {
      this.fail('Paxa live returned an invalid event.');
    }
  }

  private fail(message: string) {
    if (this.closed) return;

    this.stop();
    this.options.onError(message);
  }
}
