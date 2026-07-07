import { describe, expect, test } from 'vitest';

import { getTapTildeSettingsUpdate } from '$objects/tap~/tap-messages';
import { TapNode } from '$objects/tap~/native-dsp/nodes/tap.node';
import { schemaFromNode } from '$lib/objects/schemas/from-v2-node';

describe('tap~ command messages', () => {
  test('accepts setting commands in the supported ranges', () => {
    expect(getTapTildeSettingsUpdate({ type: 'setMode', value: 'xy' })).toEqual({
      mode: 'xy'
    });

    expect(getTapTildeSettingsUpdate({ type: 'setFpsLimit', value: 60 })).toEqual({
      fps: 60
    });

    expect(getTapTildeSettingsUpdate({ type: 'setZeroCrossing', value: false })).toEqual({
      zeroCrossing: false
    });

    expect(getTapTildeSettingsUpdate({ type: 'setSamples', value: 1024 })).toEqual({
      bufferSize: 1024
    });
  });

  test('clamps numeric commands to the UI-supported ranges', () => {
    expect(getTapTildeSettingsUpdate({ type: 'setFpsLimit', value: -10 })).toEqual({
      fps: 0
    });

    expect(getTapTildeSettingsUpdate({ type: 'setFpsLimit', value: 200 })).toEqual({
      fps: 120
    });

    expect(getTapTildeSettingsUpdate({ type: 'setSamples', value: 12 })).toEqual({
      bufferSize: 64
    });

    expect(getTapTildeSettingsUpdate({ type: 'setSamples', value: 4096 })).toEqual({
      bufferSize: 2048
    });
  });

  test('ignores unsupported commands and invalid values', () => {
    expect(getTapTildeSettingsUpdate({ type: 'setMode', value: 'polar' })).toBeNull();
    expect(getTapTildeSettingsUpdate({ type: 'setZeroCrossing', value: 'false' })).toBeNull();
    expect(getTapTildeSettingsUpdate({ type: 'setSamples', value: Number.NaN })).toBeNull();
    expect(getTapTildeSettingsUpdate('setSamples 512')).toBeNull();
  });
});

describe('tap~ generated schema', () => {
  test('uses the public tap~ ports and handle ids from the native node metadata', () => {
    const schema = schemaFromNode(TapNode, 'audio');

    expect(schema.inlets.map(({ id, handle }) => ({ id, handle }))).toEqual([
      { id: 'in', handle: { handleType: 'audio', handleId: 0 } },
      { id: 'y', handle: { handleType: 'audio', handleId: 1 } },
      { id: 'command', handle: { handleType: 'message', handleId: 0 } }
    ]);

    expect(schema.outlets.map(({ id, handle }) => ({ id, handle }))).toEqual([
      { id: 'out', handle: { handleType: 'message', handleId: 0 } }
    ]);
  });
});
