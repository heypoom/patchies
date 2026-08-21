import { describe, expect, it } from 'vitest';
import { BrowserEventStream, type BrowserEvent } from './browser-event-stream';

describe('BrowserEventStream', () => {
  it('continues delivering events after more than three stream chunks', async () => {
    let controller: ReadableStreamDefaultController<string> | undefined;

    const events: BrowserEvent[] = [];

    const open = async () =>
      new ReadableStream<string>({
        start(nextController) {
          controller = nextController;
        }
      }).getReader();

    const stream = new BrowserEventStream({
      open,
      onSessionNotFound: () => {},
      onEvent: async (event) => {
        events.push(event);
      }
    });

    stream.start();
    if (!controller) throw new Error('browser event stream did not open');

    for (let id = 1; id <= 4; id++) {
      controller.enqueue(`id: ${id}\nevent: tick\n\n`);
    }

    await eventually(() => events.length === 4);
    stream.stop();

    expect(events.map((event) => event.id)).toEqual([1, 2, 3, 4]);
  });
});

const eventually = async (predicate: () => boolean): Promise<void> => {
  for (let attempt = 0; attempt < 20; attempt++) {
    if (predicate()) return;

    await Promise.resolve();
  }

  throw new Error('condition was not satisfied');
};
