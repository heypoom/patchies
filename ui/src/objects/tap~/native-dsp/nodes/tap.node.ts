import { createWorkletDspNode } from '$lib/audio/native-dsp/create-worklet-dsp-node';
import workletUrl from '../processors/tap.processor?worker&url';
import { Type } from '@sinclair/typebox';
import {
  getTapTildeSettingsUpdate,
  SetTapFpsLimit,
  SetTapMode,
  SetTapSamples,
  SetTapZeroCrossing
} from '../../tap-messages';

export const TapNode = createWorkletDspNode({
  type: 'tap~',
  group: 'processors',
  description: 'Capture audio frames and forward them as messages',
  runtimeManaged: true,

  workletUrl,

  audioInlets: 2,
  audioOutlets: 0,

  inlets: [
    {
      name: 'in',
      type: 'signal',
      description: 'Audio signal (or X axis in XY mode)',
      handle: { handleType: 'audio', handleId: 0 }
    },
    {
      name: 'y',
      type: 'signal',
      description: 'Y axis signal (XY mode only)',
      handle: { handleType: 'audio', handleId: 1 }
    },
    {
      name: 'bufferSize',
      type: 'int',
      description: 'Number of samples captured per frame',
      defaultValue: 512,
      minNumber: 64,
      maxNumber: 2048,
      hideInlet: true,
      hideDocs: true
    },
    {
      name: 'mode',
      type: 'string',
      description: 'Capture mode',
      defaultValue: 'wave',
      options: ['wave', 'xy'],
      hideInlet: true,
      hideDocs: true
    },
    {
      name: 'fps',
      type: 'float',
      description: 'Max refresh rate in fps (0 = unlimited)',
      defaultValue: 0,
      minNumber: 0,
      maxNumber: 120,
      hideInlet: true,
      hideDocs: true
    },
    {
      name: 'zeroCrossing',
      type: 'bool',
      description: 'Trigger captures on rising zero-crossings for stable scope-style frames',
      defaultValue: true,
      hideInlet: true,
      hideDocs: true
    }
  ],

  schemaInlets: [
    {
      name: 'in',
      type: 'signal',
      description: 'Audio signal (or X axis in XY mode)',
      handle: { handleType: 'audio', handleId: 0 }
    },
    {
      name: 'y',
      type: 'signal',
      description: 'Y axis signal (XY mode only)',
      handle: { handleType: 'audio', handleId: 1 }
    },
    {
      name: 'command',
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
      name: 'out',
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

  tags: ['audio', 'scope', 'waveform', 'oscilloscope', 'capture', 'tap', 'signal', 'analysis'],

  getMessageSettingsUpdate: getTapTildeSettingsUpdate
});
