import { reactive } from 'vue';
import { expect, test, vi } from 'vitest';
import { MessageSystem } from '$lib/messages/MessageSystem';
import { WorkerNodeSystem } from './WorkerNodeSystem';

const { posted } = vi.hoisted(() => ({
  posted: vi.fn()
}));

vi.mock('../../workers/js/jsWorker?worker', () => ({
  default: class {
    postMessage(message: unknown) {
      posted(structuredClone(message));
    }
    addEventListener() {}
    terminate() {}
  }
}));

vi.mock('$lib/audio/v2/AudioService', () => ({ AudioService: {} }));
vi.mock('$lib/audio/SuperSonicManager', () => ({ SuperSonicManager: {} }));
vi.mock('$lib/canvas/GLSystem', () => ({ GLSystem: {} }));

vi.mock('$lib/audio/AudioAnalysisSystem', () => ({
  AudioAnalysisSystem: { getInstance: () => ({}) }
}));

vi.mock('$lib/messages/DirectChannelService', () => ({
  DirectChannelService: { getInstance: () => ({ registerWorker() {}, unregisterWorker() {} }) }
}));

test('forwards reactive message data as a plain snapshot to a worker', async () => {
  const system = new WorkerNodeSystem();

  const messages = MessageSystem.getInstance();
  await system.create('worker-snapshot-test');

  const data = reactive({ items: [{ text: 'original' }], bytes: new Uint8Array([3]) });
  messages.registerNode('worker-snapshot-test').sendMessage({ source: 'vue-test', data });
  data.items[0].text = 'edited';

  const delivered = posted.mock.calls.find(([message]) => message.type === 'incomingMessage')?.[0];
  expect(delivered.data.items).toEqual([{ text: 'original' }]);
  expect(delivered.data.bytes).toEqual(new Uint8Array([3]));

  system.destroy('worker-snapshot-test');
  messages.unregisterNode('worker-snapshot-test');
});
