import type { AudioNodeV2 } from '../interfaces/audio-nodes';

export class PatchbayAudioEndpoint implements AudioNodeV2 {
  static type = 'patchbay-audio-endpoint~';

  readonly nodeId: string;
  audioNode: GainNode;

  constructor(nodeId: string, audioContext: AudioContext) {
    this.nodeId = nodeId;

    this.audioNode = audioContext.createGain();
    this.audioNode.gain.value = 1;
  }

  destroy(): void {
    this.audioNode.disconnect();
  }
}
