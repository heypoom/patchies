/** Feeds MP3 chunks into the same media element used by the node's audio outlet. */
export class SpeechStreamPlayer {
  private readonly source = new MediaSource();
  private readonly url = URL.createObjectURL(this.source);
  private readonly opened: Promise<SourceBuffer>;
  private stopped = false;
  private rejectPending: ((reason: Error) => void) | undefined;

  static isSupported = () =>
    typeof MediaSource !== 'undefined' && MediaSource.isTypeSupported('audio/mpeg');

  constructor(play: (url: string) => void) {
    this.opened = new Promise((resolve, reject) => {
      this.rejectPending = reject;

      this.source.addEventListener(
        'sourceopen',
        () => {
          if (this.stopped) return;

          try {
            resolve(this.source.addSourceBuffer('audio/mpeg'));
            this.rejectPending = undefined;
          } catch (error) {
            reject(error);
          }
        },
        { once: true }
      );
    });

    play(this.url);
  }

  async append(chunk: Uint8Array<ArrayBuffer>) {
    const buffer = await this.opened;
    if (this.stopped) throw new DOMException('Speech stopped', 'AbortError');

    await new Promise<void>((resolve, reject) => {
      const cleanup = () => {
        buffer.removeEventListener('updateend', onEnd);
        buffer.removeEventListener('error', onError);
        this.rejectPending = undefined;
      };
      const onEnd = () => {
        cleanup();
        resolve();
      };
      const onError = () => {
        cleanup();
        reject(new Error('Could not decode streamed speech. Disable streaming in model settings.'));
      };

      this.rejectPending = (reason) => {
        cleanup();
        reject(reason);
      };
      buffer.addEventListener('updateend', onEnd, { once: true });
      buffer.addEventListener('error', onError, { once: true });

      try {
        buffer.appendBuffer(chunk);
      } catch (error) {
        cleanup();
        reject(error);
      }
    });
  }

  async finish() {
    await this.opened;

    if (!this.stopped && this.source.readyState === 'open') {
      this.source.endOfStream();
    }
  }

  stop() {
    if (this.stopped) return;

    this.stopped = true;
    this.rejectPending?.(new DOMException('Speech stopped', 'AbortError'));
    URL.revokeObjectURL(this.url);
  }
}
