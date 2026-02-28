import { createWorkletDspNode } from '../create-worklet-dsp-node';
import { BeatPortSchema } from '../schemas/beat.schema';
import { Transport } from '$lib/transport/Transport';
import { transportStore } from '../../../../stores/transport.store';
import workletUrl from '../processors/beat.processor?worker&url';

/** Interval in ms for periodic transport resync (drift correction + seek handling) */
const RESYNC_INTERVAL_MS = 250;

function sendTransportSync(audioNode: AudioWorkletNode): void {
  audioNode.port.postMessage({
    type: 'message-inlet',
    inlet: 0,
    message: {
      cmd: 'transport-sync',
      isPlaying: Transport.isPlaying,
      seconds: Transport.seconds,
      bpm: Transport.bpm,
      timeSignature: [Transport.beatsPerBar, Transport.denominator] as [number, number]
    }
  });
}

export const BeatNode = createWorkletDspNode({
  type: 'beat~',
  group: 'sources',
  description: 'Beat-synced ramp (0 to 1), driven by transport BPM',

  workletUrl,

  audioInlets: 0,
  audioOutlets: 1,

  ...BeatPortSchema,

  tags: ['audio', 'oscillator', 'beat', 'transport', 'clock', 'signal'],

  afterCreate(audioNode) {
    // Send initial transport state
    sendTransportSync(audioNode);

    // Subscribe to store changes (BPM, time signature, isPlaying)
    const unsubscribe = transportStore.subscribe(() => {
      sendTransportSync(audioNode);
    });

    // Periodic resync for drift correction and seek handling
    const interval = setInterval(() => {
      sendTransportSync(audioNode);
    }, RESYNC_INTERVAL_MS);

    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }
});
