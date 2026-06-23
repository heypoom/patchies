import { describe, expect, test } from 'vitest';

import { getTapTildeSettingsUpdate } from './tap-tilde';

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
