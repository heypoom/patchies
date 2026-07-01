import { match, P } from 'ts-pattern';
import type { AudioNodeV2, AudioNodeGroup } from '$lib/audio/v2/interfaces/audio-nodes';
import type { ObjectInlet, ObjectOutlet } from '$lib/objects/v2/object-metadata';
import { BASE_NOTE, type NoteOffMode, type PadCount } from './constants';
import { messages } from '$lib/objects/schemas';
import { NoteOn, NoteOff } from '$lib/objects/schemas/common';
import { LoadPad, TriggerPad, padsMessages } from './schema';
import { Type } from '@sinclair/typebox';

interface Voice {
  source: AudioBufferSourceNode;
  gain: GainNode;
  triggerTimer?: ReturnType<typeof setTimeout>;
}

const getNonNegativeNumber = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : undefined;

export const getPadBangVelocity = (value: unknown): number | undefined => {
  const normalizedValue = getNonNegativeNumber(value);
  return normalizedValue === undefined ? undefined : normalizedValue * 127;
};

export class PadsAudioNode implements AudioNodeV2 {
  static type = 'pads~';
  static group: AudioNodeGroup = 'processors';
  static description =
    '16-pad drum sampler. Trigger samples via MIDI noteOn/noteOff messages using the GM drum map (note 36 = pad 1).';

  static inlets: ObjectInlet[] = [
    {
      name: 'message',
      type: 'message',
      description: 'Trigger pads or load samples',
      messages: [
        { schema: NoteOn, description: 'Trigger pad by MIDI note' },
        { schema: NoteOff, description: 'Release pad' },
        { schema: TriggerPad, description: 'Trigger pad by index with scheduled velocity' },
        { schema: LoadPad, description: 'Load sample into pad slot' },
        {
          schema: Type.Number({ minimum: 0, maximum: 15 }),
          description: 'Trigger pad by index with max velocity'
        }
      ]
    }
  ];

  static outlets: ObjectOutlet[] = [
    { name: 'out', type: 'signal', description: 'Stereo audio mix of all active pad voices' }
  ];

  readonly nodeId: string;
  audioNode: GainNode;

  private audioContext: AudioContext;
  private buffers: (AudioBuffer | null)[] = Array(16).fill(null);
  private voices: Map<number, Voice[]> = new Map();
  private triggerTimers = new Set<ReturnType<typeof setTimeout>>();

  /** Synced from node data — set by the component via $effect */
  noteOffMode: NoteOffMode = 'ignore';
  maxVoices: number = 4;
  padCount: PadCount = 16;

  /** Called by the audio node when a pad is triggered — component uses this for flash animation */
  onTrigger?: (padIndex: number, velocity: number) => void;

  constructor(nodeId: string, audioContext: AudioContext) {
    this.nodeId = nodeId;
    this.audioContext = audioContext;
    this.audioNode = audioContext.createGain();
    this.audioNode.gain.value = 1.0;
  }

  setBuffer(padIndex: number, buffer: AudioBuffer): void {
    this.buffers[padIndex] = buffer;
  }

  clearBuffer(padIndex: number): void {
    this.stopPadVoices(padIndex);
    this.buffers[padIndex] = null;
  }

  send(key: string, message: unknown): void {
    if (key !== 'message') return;

    match(message)
      .with(messages.noteOn, ({ note, velocity, time }) => {
        const padIndex = note - BASE_NOTE;

        if (padIndex >= 0 && padIndex < this.padCount) {
          this.triggerOn(padIndex, velocity, time);
        }
      })
      .with(messages.noteOff, ({ note, time }) => {
        const padIndex = note - BASE_NOTE;

        if (padIndex >= 0 && padIndex < this.padCount) {
          this.triggerOff(padIndex, time);
        }
      })
      .with(padsMessages.triggerPad, ({ index, value, time }) => {
        const velocity = getPadBangVelocity(value);

        if (velocity !== undefined && index >= 0 && index < this.padCount) {
          this.triggerOn(index, velocity, time);
        }
      })
      .with(P.number, (padIndex) => {
        // Allow sending just a pad index to trigger with velocity 127
        if (padIndex >= 0 && padIndex < this.padCount) {
          this.triggerOn(padIndex, 127);
        }
      })
      .otherwise(() => {});
  }

  destroy(): void {
    for (const [padIndex] of this.voices) {
      this.stopPadVoices(padIndex);
    }
    for (const timer of this.triggerTimers) {
      clearTimeout(timer);
    }
    this.triggerTimers.clear();
    this.voices.clear();
    this.audioNode.disconnect();
  }

  private triggerOn(padIndex: number, velocity: number, time?: unknown): void {
    const buffer = this.buffers[padIndex];
    if (!buffer) return;

    if (!this.voices.has(padIndex)) {
      this.voices.set(padIndex, []);
    }
    const padVoices = this.voices.get(padIndex)!;

    // If at max voices, kill the oldest
    if (padVoices.length >= this.maxVoices) {
      const oldest = padVoices.shift()!;
      this.killVoice(oldest);
    }

    // Per-voice gain so we can fade out individually on noteOff
    const voiceGain = this.audioContext.createGain();
    voiceGain.gain.value = velocity / 127;

    const source = this.audioContext.createBufferSource();
    source.buffer = buffer;
    source.connect(voiceGain);
    voiceGain.connect(this.audioNode);

    const voice: Voice = { source, gain: voiceGain };
    padVoices.push(voice);

    source.onended = () => {
      this.clearTriggerTimer(voice);
      const voices = this.voices.get(padIndex);
      if (voices) {
        const idx = voices.indexOf(voice);
        if (idx !== -1) voices.splice(idx, 1);
      }
      source.disconnect();
      voiceGain.disconnect();
    };

    const startTime = getNonNegativeNumber(time);
    if (startTime === undefined) {
      this.onTrigger?.(padIndex, velocity);
      source.start();
    } else {
      this.scheduleTriggerFlash(voice, padIndex, velocity, startTime);
      source.start(startTime);
    }
  }

  private triggerOff(padIndex: number, time?: unknown): void {
    if (this.noteOffMode === 'ignore') return;
    this.stopPadVoices(padIndex, time);
  }

  private stopPadVoices(padIndex: number, time?: unknown): void {
    const padVoices = this.voices.get(padIndex);
    if (!padVoices || padVoices.length === 0) return;

    const stopTime = getNonNegativeNumber(time) ?? this.audioContext.currentTime;
    for (const voice of padVoices) {
      if (stopTime <= this.audioContext.currentTime) {
        this.clearTriggerTimer(voice);
      }
      voice.gain.gain.setTargetAtTime(0, stopTime, 0.01);
      try {
        voice.source.stop(stopTime + 0.05);
      } catch {
        // already stopped
      }
    }
    this.voices.set(padIndex, []);
  }

  private killVoice(voice: Voice): void {
    this.clearTriggerTimer(voice);
    try {
      voice.source.stop();
    } catch {
      // already stopped
    }
    voice.source.disconnect();
    voice.gain.disconnect();
  }

  private scheduleTriggerFlash(
    voice: Voice,
    padIndex: number,
    velocity: number,
    startTime: number
  ): void {
    const delayMs = Math.max(0, (startTime - this.audioContext.currentTime) * 1000);
    if (delayMs === 0) {
      this.onTrigger?.(padIndex, velocity);
      return;
    }

    const timer = setTimeout(() => {
      this.triggerTimers.delete(timer);
      voice.triggerTimer = undefined;
      this.onTrigger?.(padIndex, velocity);
    }, delayMs);

    voice.triggerTimer = timer;
    this.triggerTimers.add(timer);
  }

  private clearTriggerTimer(voice: Voice): void {
    if (!voice.triggerTimer) return;

    clearTimeout(voice.triggerTimer);
    this.triggerTimers.delete(voice.triggerTimer);
    voice.triggerTimer = undefined;
  }
}
