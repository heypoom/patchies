import type { AudioNodeV2, AudioNodeGroup } from '../interfaces/audio-nodes';
import type { ObjectInlet, ObjectOutlet } from '$lib/objects/v2/object-metadata';

/**
 * VdoNinjaPushNode - Audio destination node for streaming audio via VDO.Ninja.
 * Receives audio from the pipeline and provides it as a MediaStream for WebRTC.
 */
export class VdoNinjaPushNode implements AudioNodeV2 {
  static type = 'vdo.ninja.push';
  static group: AudioNodeGroup = 'processors';
  static description = 'Streams audio to VDO.Ninja WebRTC';

  static inlets: ObjectInlet[] = [
    { name: 'in', type: 'signal', description: 'Audio signal to stream' }
  ];

  static outlets: ObjectOutlet[] = [];

  readonly nodeId: string;
  audioNode: GainNode;

  private audioContext: AudioContext;
  private mediaStreamDestination: MediaStreamAudioDestinationNode;

  constructor(nodeId: string, audioContext: AudioContext) {
    this.nodeId = nodeId;
    this.audioContext = audioContext;

    // Create gain node as input (receives audio from pipeline)
    this.audioNode = audioContext.createGain();
    this.audioNode.gain.value = 1.0;

    // Create MediaStreamDestination to capture audio for WebRTC
    this.mediaStreamDestination = audioContext.createMediaStreamDestination();

    // Connect: pipeline audio -> gain -> mediaStreamDestination
    this.audioNode.connect(this.mediaStreamDestination);
  }

  /**
   * Get the MediaStream containing the audio for VDO.Ninja streaming.
   */
  getMediaStream(): MediaStream {
    return this.mediaStreamDestination.stream;
  }

  /**
   * Get audio tracks from the stream.
   */
  getAudioTracks(): MediaStreamTrack[] {
    return this.mediaStreamDestination.stream.getAudioTracks();
  }

  /**
   * Handle incoming audio connections.
   * Re-establishes internal routing after AudioService disconnects all nodes.
   */
  connectFrom(source: AudioNodeV2): void {
    // Connect source to our gain node
    source.audioNode?.connect(this.audioNode);

    // Re-establish internal routing (broken by AudioService.updateEdges disconnect)
    this.audioNode.connect(this.mediaStreamDestination);
  }

  destroy(): void {
    this.audioNode.disconnect();
  }
}
