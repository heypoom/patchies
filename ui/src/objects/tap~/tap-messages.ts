import { Type } from '@sinclair/typebox';
import { schema } from '$lib/objects/schemas/types';
import { msg } from '$lib/objects/schemas/helpers';
import { clamp, isFiniteNumber, isRecord } from '$lib/utils/value-guards';

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
