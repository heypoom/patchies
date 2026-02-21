import type { AudioNodeV2, AudioNodeGroup } from '../interfaces/audio-nodes';
import type { ObjectInlet, ObjectOutlet } from '$lib/objects/v2/object-metadata';
import { Bang, Stop } from '$lib/objects/schemas/common';
import { msg, sym } from '$lib/objects/schemas/helpers';
import { Type } from '@sinclair/typebox';

const Listen = sym('listen');
const SetLanguage = msg('setLanguage', { value: Type.String() });
const SetPrompt = msg('setPrompt', { value: Type.String() });

/**
 * Audio node for ai.stt — captures incoming audio via MediaStreamDestination
 * for speech-to-text transcription. The Svelte component drives the recording
 * and Gemini API calls.
 */
export class AiSttAudioNode implements AudioNodeV2 {
  static type = 'ai.stt';
  static group: AudioNodeGroup = 'processors';
  static headless = true; // UI handled by Svelte component, not ObjectNode
  static description = 'Transcribe speech to text using Gemini AI';

  static inlets: ObjectInlet[] = [
    { name: 'in', type: 'signal', description: 'Audio input to transcribe' },
    {
      name: 'message',
      type: 'message',
      description: 'Control messages',
      messages: [
        { schema: Listen, description: 'Start recording' },
        { schema: Stop, description: 'Stop recording and transcribe' },
        { schema: Bang, description: 'Toggle recording on/off' },
        { schema: Type.String(), description: 'Set language hint and start' },
        { schema: SetLanguage, description: 'Set BCP-47 language hint' },
        { schema: SetPrompt, description: 'Set transcription context hint' }
      ]
    }
  ];

  static outlets: ObjectOutlet[] = [
    { name: 'msg', type: 'message', description: 'Transcribed text output' }
  ];

  readonly nodeId: string;
  audioNode: GainNode;

  /** MediaStreamDestination for capturing audio from the graph */
  readonly recordingDestination: MediaStreamAudioDestinationNode;

  /** AnalyserNode for level metering (exposed for UI) */
  readonly analyser: AnalyserNode;

  private audioContext: AudioContext;
  private connectedSources = new Set<string>();

  constructor(nodeId: string, audioContext: AudioContext) {
    this.nodeId = nodeId;
    this.audioContext = audioContext;

    // Gain node as the primary audio node (for default routing)
    this.audioNode = audioContext.createGain();
    this.audioNode.gain.value = 1.0;

    // Analyser for level monitoring
    this.analyser = audioContext.createAnalyser();
    this.analyser.fftSize = 256;
    this.analyser.smoothingTimeConstant = 0.8;

    // MediaStreamDestination captures audio for MediaRecorder
    this.recordingDestination = audioContext.createMediaStreamDestination();

    // Chain: gain → analyser → recordingDestination
    this.audioNode.connect(this.analyser);
    this.analyser.connect(this.recordingDestination);
  }

  /**
   * Handle incoming audio connections.
   * Routes source audio to our gain node (which feeds analyser → recording destination).
   */
  connectFrom(source: AudioNodeV2): void {
    if (!source.audioNode) return;
    source.audioNode.connect(this.audioNode);

    // Re-establish internal chain — AudioService.updateEdges() disconnects all
    // audioNodes, which breaks gain → analyser → recordingDestination.
    // Web Audio connect() is idempotent so this is safe to call every time.
    this.audioNode.connect(this.analyser);
    this.analyser.connect(this.recordingDestination);

    this.connectedSources.add(source.nodeId);
  }

  /** Get current RMS level (0-1) from the analyser */
  getLevel(): number {
    const data = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteTimeDomainData(data);

    let sum = 0;
    for (let i = 0; i < data.length; i++) {
      const sample = (data[i] - 128) / 128;
      sum += sample * sample;
    }

    return Math.sqrt(sum / data.length);
  }

  destroy(): void {
    this.audioNode.disconnect();
    this.analyser.disconnect();
    this.recordingDestination.disconnect();
    this.connectedSources.clear();
  }
}
