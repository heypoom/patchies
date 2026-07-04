import type { AudioNodeGroup, AudioNodeV2 } from '$lib/audio/v2/interfaces/audio-nodes';
import type { ObjectInlet, ObjectOutlet } from '$lib/objects/v2/object-metadata';
import { logger } from '$lib/utils/logger';

import workletUrl from '$objects/meter~/native-dsp/processors/meter.processor?worker&url';

type ModuleState = { ready: boolean; promise: Promise<void> | null };

const moduleStateByContext = new WeakMap<AudioContext, ModuleState>();

function getModuleState(audioContext: AudioContext): ModuleState {
  let state = moduleStateByContext.get(audioContext);

  if (!state) {
    state = { ready: false, promise: null };
    moduleStateByContext.set(audioContext, state);
  }

  return state;
}

export class MeterAudioNode implements AudioNodeV2 {
  static type = 'meter~';
  static group: AudioNodeGroup = 'processors';
  static description = 'Visual audio level meter';

  static inlets: ObjectInlet[] = [
    {
      name: 'in',
      type: 'signal',
      description: 'Audio signal to measure'
    }
  ];

  static outlets: ObjectOutlet[] = [
    {
      name: 'level',
      type: 'message',
      description: 'Current RMS level of the loudest channel'
    }
  ];

  readonly nodeId: string;
  audioNode: AudioWorkletNode | null = null;
  latestLevels: number[] = [0];

  private audioContext: AudioContext;

  constructor(nodeId: string, audioContext: AudioContext) {
    this.nodeId = nodeId;
    this.audioContext = audioContext;
  }

  async create(): Promise<void> {
    const moduleState = getModuleState(this.audioContext);

    if (!moduleState.ready) {
      if (!moduleState.promise) {
        moduleState.promise = (async () => {
          try {
            const processorUrl = new URL(workletUrl, import.meta.url);
            await this.audioContext.audioWorklet.addModule(processorUrl.href);
            moduleState.ready = true;
          } catch (error) {
            moduleState.promise = null;
            moduleState.ready = false;
            logger.error('cannot add meter~ worklet module:', error);
            throw error;
          }
        })();
      }

      await moduleState.promise;
    }

    this.audioNode = new AudioWorkletNode(this.audioContext, 'meter~', {
      numberOfInputs: 1,
      numberOfOutputs: 0,
      channelCountMode: 'max',
      channelInterpretation: 'discrete'
    });

    this.audioNode.port.onmessage = (event) => {
      if (event.data.type !== 'meter-levels' || !Array.isArray(event.data.levels)) return;

      this.latestLevels = event.data.levels.map((level: unknown) =>
        typeof level === 'number' && Number.isFinite(level) ? level : 0
      );
    };
  }

  connectFrom(source: AudioNodeV2): void {
    if (!this.audioNode || !source.audioNode) return;

    source.audioNode.connect(this.audioNode);
  }

  destroy(): void {
    if (!this.audioNode) return;

    this.audioNode.port.onmessage = null;
    this.audioNode.port.postMessage({ type: 'stop' });
    this.audioNode.disconnect();
    this.audioNode = null;
  }
}
