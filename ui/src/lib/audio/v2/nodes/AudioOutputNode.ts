import type { AudioNodeV2, AudioNodeGroup } from '../interfaces/audio-nodes';
import type { ObjectInlet, ObjectOutlet } from '$lib/objects/v2/object-metadata';

export interface AudioOutputSettings {
  deviceId: string;
}

export const DEFAULT_AUDIO_OUTPUT_SETTINGS: AudioOutputSettings = {
  deviceId: ''
};

/**
 * AudioOutputNode implements the out~ (audio output) node.
 * Routes audio signals to the computer's audio output (speakers/headphones).
 *
 * Each out~ creates its own gain node that automatically connects to the shared
 * outGain, allowing multiple out~ nodes to exist in a patch.
 */
export class AudioOutputNode implements AudioNodeV2 {
  static type = 'out~';
  static group: AudioNodeGroup = 'destinations';
  static description = 'Audio output to speakers';

  static inlets: ObjectInlet[] = [
    { name: 'in', type: 'signal', description: 'Audio signal to output' }
  ];

  static outlets: ObjectOutlet[] = [];

  readonly nodeId: string;
  audioNode: GainNode;

  private audioContext: AudioContext;
  settings: AudioOutputSettings = { ...DEFAULT_AUDIO_OUTPUT_SETTINGS };

  constructor(nodeId: string, audioContext: AudioContext) {
    this.nodeId = nodeId;
    this.audioContext = audioContext;
    this.audioNode = audioContext.createGain();
    this.audioNode.gain.value = 1.0;
  }

  create(): void {}
  send(): void {}

  /**
   * Update output device - requires setSinkId on AudioContext (Chrome 110+).
   * Note: Firefox does NOT support AudioContext.setSinkId, only HTMLMediaElement.setSinkId.
   * So output device selection for Web Audio only works in Chrome/Edge.
   */
  async updateSettings(newSettings: Partial<AudioOutputSettings>): Promise<void> {
    this.settings = { ...this.settings, ...newSettings };

    if (!newSettings.deviceId) return;

    // setSinkId is available on AudioContext in Chrome 110+
    if ('setSinkId' in this.audioContext) {
      try {
        await (
          this.audioContext as AudioContext & { setSinkId: (id: string) => Promise<void> }
        ).setSinkId(newSettings.deviceId);
      } catch (error) {
        console.error('Failed to set audio output device:', error);
      }
    }
  }

  /**
   * Check if browser supports AudioContext.setSinkId for output device selection.
   * Currently only Chrome 110+ supports this. Firefox only supports setSinkId on HTMLMediaElement,
   * not AudioContext, so Web Audio output device selection is not possible in Firefox.
   */
  static get supportsOutputDeviceSelection(): boolean {
    return typeof AudioContext !== 'undefined' && 'setSinkId' in AudioContext.prototype;
  }

  getAudioParam(): AudioParam | null {
    return null;
  }
}
