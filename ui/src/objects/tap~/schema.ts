import { Type } from '@sinclair/typebox';
import { schema, type ObjectSchema } from '$lib/objects/schemas/types';
import { msg } from '$lib/objects/schemas/helpers';

type TapMode = 'wave' | 'xy';

export type TapTildeSettingsUpdate = {
  mode?: TapMode;
  fps?: number;
  zeroCrossing?: boolean;
  bufferSize?: number;
};

export const SetTapMode = msg('setMode', {
  value: Type.Union([Type.Literal('wave'), Type.Literal('xy')])
});

export const SetTapFpsLimit = msg('setFpsLimit', {
  value: Type.Number({ minimum: 0, maximum: 120 })
});

export const SetTapZeroCrossing = msg('setZeroCrossing', {
  value: Type.Boolean()
});

export const SetTapSamples = msg('setSamples', {
  value: Type.Integer({ minimum: 64, maximum: 2048 })
});

export const tapTildeMessages = {
  setMode: schema(SetTapMode),
  setFpsLimit: schema(SetTapFpsLimit),
  setZeroCrossing: schema(SetTapZeroCrossing),
  setSamples: schema(SetTapSamples)
};

const MIN_FPS = 0;
const MAX_FPS = 120;
const MIN_SAMPLES = 64;
const MAX_SAMPLES = 2048;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

export function getTapTildeSettingsUpdate(message: unknown): TapTildeSettingsUpdate | null {
  if (!isRecord(message) || typeof message.type !== 'string') {
    return null;
  }

  if (message.type === 'setMode') {
    return message.value === 'wave' || message.value === 'xy' ? { mode: message.value } : null;
  }

  if (message.type === 'setFpsLimit') {
    return isFiniteNumber(message.value) ? { fps: clamp(message.value, MIN_FPS, MAX_FPS) } : null;
  }

  if (message.type === 'setZeroCrossing') {
    return typeof message.value === 'boolean' ? { zeroCrossing: message.value } : null;
  }

  if (message.type === 'setSamples') {
    if (!isFiniteNumber(message.value)) return null;
    return { bufferSize: Math.round(clamp(message.value, MIN_SAMPLES, MAX_SAMPLES)) };
  }

  return null;
}

export const tapTildeSchema: ObjectSchema = {
  type: 'tap~',
  category: 'audio',
  description: 'Capture audio frames and forward them as messages',
  inlets: [
    {
      id: 'in',
      type: 'signal',
      description: 'Audio signal (or X axis in XY mode)',
      handle: { handleType: 'audio', handleId: 0 }
    },
    {
      id: 'y',
      type: 'signal',
      description: 'Y axis signal (XY mode only)',
      handle: { handleType: 'audio', handleId: 1 }
    },
    {
      id: 'command',
      type: 'message',
      description: 'Control messages for tap settings',
      handle: { handleType: 'message', handleId: 0 },
      messages: [
        { schema: SetTapMode, description: 'Set capture mode to wave or xy' },
        {
          schema: SetTapFpsLimit,
          description: 'Set FPS limit from 0 to 120, where 0 is unlimited'
        },
        {
          schema: SetTapZeroCrossing,
          description: 'Enable or disable zero-crossing trigger detection'
        },
        { schema: SetTapSamples, description: 'Set sample buffer size from 64 to 2048' }
      ]
    }
  ],
  outlets: [
    {
      id: 'out',
      type: 'message',
      description: 'Captured buffer',
      handle: { handleType: 'message', handleId: 0 },
      messages: [
        {
          schema: Type.Unsafe<Float32Array>({ type: 'Float32Array' }),
          description: 'Wave mode sample buffer'
        },
        {
          schema: Type.Object({
            type: Type.Literal('xy'),
            x: Type.Unsafe<Float32Array>({ type: 'Float32Array' }),
            y: Type.Unsafe<Float32Array>({ type: 'Float32Array' })
          }),
          description: 'XY mode sample buffers'
        }
      ]
    }
  ],
  tags: ['audio', 'scope', 'waveform', 'oscilloscope', 'capture', 'tap', 'signal', 'analysis']
};
