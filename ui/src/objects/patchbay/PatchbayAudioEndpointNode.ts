import type { AudioNodeGroup, AudioNodeV2 } from '$lib/audio/v2/interfaces/audio-nodes';

export class PatchbayAudioEndpoint implements AudioNodeV2 {
  static type = 'patchbay-audio-endpoint~';
  static group: AudioNodeGroup = 'processors';
  static description = 'Hidden patchbay audio endpoint';
  static tags = ['audio', 'patchbay', 'internal'];
  static headless = true;
  static includeInGeneratedSchemas = false;

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
