import { match, P } from 'ts-pattern';

import type { AudioNodeV2, AudioNodeGroup } from '../interfaces/audio-nodes';
import type { ObjectInlet, ObjectOutlet } from '$lib/objects/v2/object-metadata';

type PlayMessage = {
  [key: string]: unknown;
  type: 'bang' | 'play';

  time?: unknown;
  offset?: unknown;
  duration?: unknown;
  gain?: unknown;
  playbackRate?: unknown;
  replaceImmediate?: boolean;
};

type LoopMessage = {
  [key: string]: unknown;
  type: 'loop';
  start: number;
  end: number;
  time?: unknown;
  offset?: unknown;
  duration?: unknown;
  gain?: unknown;
};

type NoteOnMessage = {
  [key: string]: unknown;
  type: 'noteOn';
  note: number;
  velocity: number;
  time?: unknown;
};

type NoteOffMessage = {
  [key: string]: unknown;
  type: 'noteOff';
  note: number;
  time?: unknown;
};

type NoteOffMode = 'one-shot' | 'held';

const getNonNegativeNumber = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : undefined;

const ROOT_NOTE = 60;

function noteToPlaybackRate(note: number): number {
  return 2 ** ((note - ROOT_NOTE) / 12);
}

export class SamplerNode implements AudioNodeV2 {
  static type = 'sampler~';
  static group: AudioNodeGroup = 'processors';

  static description =
    'Records audio into a buffer and plays it back with loop points, playback rate, and detune control';

  static inlets: ObjectInlet[] = [
    {
      name: 'message',
      type: 'message',
      description:
        'Control messages: record, play, stop, loop, loopOff, setStart, setEnd, playbackRate, detune. Also accepts Float32Array directly to set buffer.'
    }
  ];

  static outlets: ObjectOutlet[] = [
    { name: 'out', type: 'signal', description: 'Audio output from sampler playback' }
  ];

  readonly nodeId: string;
  audioNode: GainNode;

  audioBuffer: AudioBuffer | null = null;

  private audioContext: AudioContext;
  private recordingDestination: MediaStreamAudioDestinationNode;
  private mediaRecorder: MediaRecorder | null = null;
  private sourceNode: AudioBufferSourceNode | null = null;
  private scheduledSources = new Set<AudioBufferSourceNode>();
  private sourceGains = new WeakMap<AudioBufferSourceNode, GainNode>();
  private noteSources = new Map<number, Set<AudioBufferSourceNode>>();
  private loopStart: number = 0;
  private loopEnd: number = 0;
  private playbackRate: number = 1;
  private detune: number = 0;
  private noteOffMode: NoteOffMode = 'one-shot';

  constructor(nodeId: string, audioContext: AudioContext) {
    this.nodeId = nodeId;
    this.audioContext = audioContext;

    // Create main gain node for output
    this.audioNode = audioContext.createGain();
    this.audioNode.gain.value = 1.0;

    // Create MediaStreamDestination for recording input
    // This captures audio into a MediaStream for the MediaRecorder
    this.recordingDestination = audioContext.createMediaStreamDestination();
  }

  send(key: string, message: unknown): void {
    if (key !== 'message' || message === null || message === undefined) {
      return;
    }

    // Handle Float32Array directly - set as audio buffer
    if (message instanceof Float32Array) {
      this.setBufferFromFloats(message);
      return;
    }

    if (typeof message === 'number') {
      const gain = getNonNegativeNumber(message);
      if (gain !== undefined) {
        this.handlePlay({ type: 'play', gain });
      }
      return;
    }

    if (typeof message !== 'object') {
      return;
    }

    const msg = message as Record<string, unknown>;

    match(msg)
      .with({ type: 'record' }, this.handleRecord.bind(this))
      .with({ type: 'end' }, () => {
        if (this.mediaRecorder?.state === 'recording') {
          this.mediaRecorder.stop();
        }
      })
      .with({ type: 'bang' }, this.handlePlay.bind(this))
      .with({ type: 'play' }, this.handlePlay.bind(this))
      .with({ type: 'noteOn', note: P.number, velocity: P.number }, this.handleNoteOn.bind(this))
      .with({ type: 'noteOff', note: P.number }, this.handleNoteOff.bind(this))
      .with({ type: 'setNoteOffMode', value: P.union('one-shot', 'held') }, ({ value }) => {
        this.noteOffMode = value;
      })
      .with({ type: 'stop' }, this.stopPlayback.bind(this))
      .with({ type: 'loop', start: P.number, end: P.number }, this.handleLoop.bind(this))
      .with({ type: 'loopOff' }, () => {
        if (this.sourceNode) {
          this.sourceNode.loop = false;
        }
      })
      .with({ type: 'setStart', value: P.number }, ({ value }) => {
        this.loopStart = value;

        if (this.sourceNode && this.sourceNode.loop) {
          this.sourceNode.loopStart = value;
        }

        for (const source of this.scheduledSources) {
          if (source.loop) {
            source.loopStart = value;
          }
        }
      })
      .with({ type: 'setEnd', value: P.number }, ({ value }) => {
        this.loopEnd = value;

        if (this.sourceNode && this.sourceNode.loop) {
          this.sourceNode.loopEnd = value;
        }

        for (const source of this.scheduledSources) {
          if (source.loop) {
            source.loopEnd = value;
          }
        }
      })
      .with({ type: 'setPlaybackRate', value: P.number }, ({ value }) => {
        this.playbackRate = value;

        if (this.sourceNode) {
          this.sourceNode.playbackRate.value = value;
        }

        for (const source of this.scheduledSources) {
          source.playbackRate.value = value;
        }
      })
      .with({ type: 'setDetune', value: P.number }, ({ value }) => {
        this.detune = value;

        if (this.sourceNode) {
          this.sourceNode.detune.value = value;
        }

        for (const source of this.scheduledSources) {
          source.detune.value = value;
        }
      });
  }

  get destinationStream(): MediaStream {
    return this.recordingDestination.stream;
  }

  connectFrom(source: AudioNodeV2): void {
    // Custom handler for when another node connects TO sampler~
    // Route incoming audio to our recordingDestination for capture
    if (source.audioNode) {
      source.audioNode.connect(this.recordingDestination);
    }
  }

  destroy(): void {
    this.stopPlayback();
    if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
      this.mediaRecorder.stop();
    }
    this.audioNode.disconnect();
    this.recordingDestination.disconnect();
  }

  private handleLoop(message: LoopMessage): void {
    if (!this.audioBuffer) {
      return;
    }

    const { start, end } = message;
    const time = getNonNegativeNumber(message.time) ?? 0;
    const offset = getNonNegativeNumber(message.offset) ?? start;
    const duration = getNonNegativeNumber(message.duration);
    const gain = getNonNegativeNumber(message.gain) ?? 1;
    const isFutureScheduled = time > this.audioContext.currentTime;

    if (!isFutureScheduled) {
      this.stopPlayback();
    }

    // Reset loop points for new recording
    this.loopStart = start;
    this.loopEnd = end;

    // Create new source node
    const newSource = this.audioContext.createBufferSource();
    newSource.buffer = this.audioBuffer;
    newSource.loopStart = start;
    newSource.loopEnd = end;
    newSource.playbackRate.value = this.playbackRate;
    newSource.detune.value = this.detune;
    newSource.loop = true;
    this.connectSource(newSource, gain);

    if (isFutureScheduled) {
      this.scheduledSources.add(newSource);
    } else {
      this.sourceNode = newSource;
    }

    newSource.onended = () => {
      this.disconnectSource(newSource);
      this.scheduledSources.delete(newSource);

      if (this.sourceNode === newSource) {
        this.sourceNode = null;
      }
    };

    newSource.start(time, offset, duration);
  }

  private handleNoteOn(message: NoteOnMessage): void {
    const note = getNonNegativeNumber(message.note);
    const velocity = getNonNegativeNumber(message.velocity);

    if (note === undefined || velocity === undefined) return;

    if (velocity === 0) {
      if (this.noteOffMode === 'held') {
        this.handleNoteOff({ type: 'noteOff', note, time: message.time });
      }
      return;
    }

    const source = this.handlePlay({
      type: 'play',
      time: message.time,
      gain: velocity / 127,
      playbackRate: noteToPlaybackRate(note),
      replaceImmediate: false
    });

    if (!source) return;

    const sources = this.noteSources.get(note) ?? new Set<AudioBufferSourceNode>();
    sources.add(source);
    this.noteSources.set(note, sources);
  }

  private handleNoteOff(message: NoteOffMessage): void {
    if (this.noteOffMode !== 'held') return;

    const note = getNonNegativeNumber(message.note);
    if (note === undefined) return;

    const sources = this.noteSources.get(note);
    if (!sources) return;

    const time = getNonNegativeNumber(message.time);

    for (const source of sources) {
      this.stopSource(source, time);
      this.scheduledSources.delete(source);
    }

    this.noteSources.delete(note);
  }

  private async handleRecord(): Promise<void> {
    if (this.mediaRecorder) {
      return;
    }

    // Reset loop points
    this.loopStart = 0;
    this.loopEnd = 0;

    // Clear old audio buffer so polling can detect the new one
    this.audioBuffer = null;

    const recorder = new MediaRecorder(this.recordingDestination.stream);
    const recordedChunks: Blob[] = [];

    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        recordedChunks.push(event.data);
      }
    };

    recorder.onstop = async () => {
      try {
        const blob = new Blob(recordedChunks, { type: 'audio/wav' });
        const arrayBuffer = await blob.arrayBuffer();
        const decoded = await this.audioContext.decodeAudioData(arrayBuffer);
        this.audioBuffer = this.trimSilence(decoded);
        this.mediaRecorder = null;
      } catch (error) {
        console.error('Failed to process recorded audio:', error);
        this.mediaRecorder = null;
      }
    };

    recorder.start();
    this.mediaRecorder = recorder;
  }

  private handlePlay(message: PlayMessage): AudioBufferSourceNode | null {
    if (!this.audioBuffer) {
      return null;
    }

    // Create new source node
    const newSource = this.audioContext.createBufferSource();
    newSource.buffer = this.audioBuffer;
    newSource.playbackRate.value = getNonNegativeNumber(message.playbackRate) ?? this.playbackRate;
    newSource.detune.value = this.detune;

    const time = getNonNegativeNumber(message.time) ?? 0;
    const offset = getNonNegativeNumber(message.offset) ?? this.loopStart;
    const gain = getNonNegativeNumber(message.gain) ?? 1;

    const duration =
      getNonNegativeNumber(message.duration) ??
      (this.loopEnd > offset ? this.loopEnd - offset : undefined);

    const isFutureScheduled = time > this.audioContext.currentTime;
    const replaceImmediate = message.replaceImmediate ?? true;

    if (isFutureScheduled) {
      this.scheduledSources.add(newSource);
    } else if (replaceImmediate) {
      this.stopImmediatePlayback();
      this.sourceNode = newSource;
    }

    // Clean up when playback ends naturally
    newSource.onended = () => {
      this.disconnectSource(newSource);
      this.scheduledSources.delete(newSource);
      this.removeSourceFromNotes(newSource);

      if (this.sourceNode === newSource) {
        this.sourceNode = null;
      }
    };

    this.connectSource(newSource, gain);
    newSource.start(time, offset, duration);
    return newSource;
  }

  private connectSource(source: AudioBufferSourceNode, gainValue: number): void {
    const gainNode = this.audioContext.createGain();
    gainNode.gain.value = gainValue;
    source.connect(gainNode);
    gainNode.connect(this.audioNode);
    this.sourceGains.set(source, gainNode);
  }

  private disconnectSource(source: AudioBufferSourceNode): void {
    source.disconnect();
    this.sourceGains.get(source)?.disconnect();
    this.sourceGains.delete(source);
  }

  private stopSource(source: AudioBufferSourceNode, time?: number): void {
    try {
      if (time !== undefined && time > this.audioContext.currentTime) {
        source.stop(time);
        return;
      }

      source.stop();
      this.disconnectSource(source);
      this.removeSourceFromNotes(source);
    } catch {
      // Ignore errors if node already stopped
    }
  }

  private stopImmediatePlayback(): void {
    if (!this.sourceNode) return;

    this.stopSource(this.sourceNode);
    this.sourceNode = null;
  }

  private stopPlayback(): void {
    this.stopImmediatePlayback();

    const noteSources = new Set<AudioBufferSourceNode>();
    for (const sources of this.noteSources.values()) {
      for (const source of sources) {
        noteSources.add(source);
      }
    }

    for (const source of noteSources) {
      this.stopSource(source);
    }

    for (const source of this.scheduledSources) {
      this.stopSource(source);
    }

    this.scheduledSources.clear();
    this.noteSources.clear();
  }

  private removeSourceFromNotes(source: AudioBufferSourceNode): void {
    for (const [note, sources] of this.noteSources) {
      sources.delete(source);

      if (sources.size === 0) {
        this.noteSources.delete(note);
      }
    }
  }

  private trimSilence(buffer: AudioBuffer, threshold = 0.01): AudioBuffer {
    const numChannels = buffer.numberOfChannels;
    const sampleRate = buffer.sampleRate;
    const length = buffer.length;

    // Find the max amplitude across all channels for each sample
    const getMaxAmplitude = (sampleIndex: number): number => {
      let max = 0;

      for (let ch = 0; ch < numChannels; ch++) {
        const channelData = buffer.getChannelData(ch);
        max = Math.max(max, Math.abs(channelData[sampleIndex]));
      }

      return max;
    };

    // Find first sample above threshold (trim leading silence)
    let startSample = 0;

    for (let i = 0; i < length; i++) {
      if (getMaxAmplitude(i) > threshold) {
        startSample = i;
        break;
      }
    }

    // Find last sample above threshold (trim trailing silence)
    let endSample = length - 1;

    for (let i = length - 1; i >= startSample; i--) {
      if (getMaxAmplitude(i) > threshold) {
        endSample = i;
        break;
      }
    }

    // Add small padding to avoid cutting off attack/release (10ms)
    const padding = Math.floor(sampleRate * 0.01);

    startSample = Math.max(0, startSample - padding);
    endSample = Math.min(length - 1, endSample + padding);

    const newLength = endSample - startSample + 1;

    // If no significant trimming, return original
    if (newLength >= length * 0.95) {
      return buffer;
    }

    // Create new trimmed buffer
    const trimmedBuffer = this.audioContext.createBuffer(numChannels, newLength, sampleRate);

    for (let ch = 0; ch < numChannels; ch++) {
      const sourceData = buffer.getChannelData(ch);
      const destData = trimmedBuffer.getChannelData(ch);

      for (let i = 0; i < newLength; i++) {
        destData[i] = sourceData[startSample + i];
      }
    }

    return trimmedBuffer;
  }

  /**
   * Set the audio buffer directly from a Float32Array.
   * Assumes mono audio at the current sample rate.
   */
  private setBufferFromFloats(samples: Float32Array): void {
    // Stop any existing playback
    this.stopPlayback();

    // Reset loop points
    this.loopStart = 0;
    this.loopEnd = 0;

    // Create AudioBuffer from Float32Array (mono, at context sample rate)
    const buffer = this.audioContext.createBuffer(1, samples.length, this.audioContext.sampleRate);
    // Copy to a new Float32Array to ensure it's backed by ArrayBuffer (not SharedArrayBuffer)
    buffer.copyToChannel(new Float32Array(samples), 0);

    this.audioBuffer = buffer;
  }
}
