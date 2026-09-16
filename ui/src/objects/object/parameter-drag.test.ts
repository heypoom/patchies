import { describe, expect, it } from 'vitest';
import {
  getDraggedParameterValue,
  isDraggableParameter,
  getDraggedOscillatorWaveform,
  isDraggableOscillatorWaveform
} from './parameter-drag';

describe('oscillator waveform dragging', () => {
  it('cycles upward in waveform order and wraps back to sine', () => {
    expect(getDraggedOscillatorWaveform({ startValue: 'sine', deltaY: 12 })).toBe('square');
    expect(getDraggedOscillatorWaveform({ startValue: 'sine', deltaY: 24 })).toBe('sawtooth');
    expect(getDraggedOscillatorWaveform({ startValue: 'sine', deltaY: 36 })).toBe('triangle');
    expect(getDraggedOscillatorWaveform({ startValue: 'sine', deltaY: 48 })).toBe('sine');
  });

  it('cycles downward and wraps across multiple cycles', () => {
    expect(getDraggedOscillatorWaveform({ startValue: 'sine', deltaY: -12 })).toBe('triangle');
    expect(getDraggedOscillatorWaveform({ startValue: 'triangle', deltaY: -12 })).toBe('sawtooth');
    expect(getDraggedOscillatorWaveform({ startValue: 'sine', deltaY: -60 })).toBe('triangle');
  });

  it('ignores small movements and returns to the initial waveform when dragged back', () => {
    expect(getDraggedOscillatorWaveform({ startValue: 'square', deltaY: 11 })).toBe('square');
    expect(getDraggedOscillatorWaveform({ startValue: 'square', deltaY: -11 })).toBe('square');
    expect(getDraggedOscillatorWaveform({ startValue: 'square', deltaY: 0 })).toBe('square');
  });

  it.each([
    { startValue: 'custom' },
    {
      startValue: [
        [0, 1],
        [0, 1]
      ]
    },
    { startValue: [new Float32Array(2), new Float32Array(2)] },
    { startValue: null }
  ])('does not change a custom or missing waveform: $startValue', ({ startValue }) => {
    expect(isDraggableOscillatorWaveform(startValue)).toBe(false);
    expect(getDraggedOscillatorWaveform({ startValue, deltaY: 12 })).toBeNull();
  });
});

describe('object parameter dragging', () => {
  it('supports finite integers, floats, and float-accepting signals', () => {
    expect(isDraggableParameter({ type: 'int' }, 2)).toBe(true);
    expect(isDraggableParameter({ type: 'float' }, 2)).toBe(true);
    expect(isDraggableParameter({ type: 'signal', acceptsFloat: true }, 0.5)).toBe(true);

    expect(isDraggableParameter({ type: 'signal' }, 2)).toBe(false);
    expect(isDraggableParameter({ type: 'string' }, '2')).toBe(false);
    expect(isDraggableParameter({ type: 'float[]' }, [2])).toBe(false);
    expect(isDraggableParameter({ type: 'float' }, null)).toBe(false);
    expect(isDraggableParameter({ type: 'float' }, Infinity)).toBe(false);
    expect(isDraggableParameter({ type: 'float' }, NaN)).toBe(false);
  });

  it('moves integers in whole steps in both directions', () => {
    const inlet = { type: 'int', defaultValue: 0 } as const;

    expect(getDraggedParameterValue({ inlet, startValue: 10, deltaY: 3.8 })).toBe(13);
    expect(getDraggedParameterValue({ inlet, startValue: 10, deltaY: -12.8 })).toBe(-2);
    expect(getDraggedParameterValue({ inlet, startValue: 10, deltaY: 0 })).toBe(10);
  });

  it('uses whole steps for whole-number float values such as oscillator frequency', () => {
    const inlet = { type: 'float', defaultValue: 440, maxPrecision: 2 } as const;

    expect(getDraggedParameterValue({ inlet, startValue: 440, deltaY: 1 })).toBe(441);
    expect(getDraggedParameterValue({ inlet, startValue: 440, deltaY: -1 })).toBe(439);

    expect(getDraggedParameterValue({ inlet, startValue: 440.5, deltaY: 1 })).toBe(440.51);
    expect(getDraggedParameterValue({ inlet, startValue: 440.5, deltaY: 51 })).toBe(441.01);
  });

  it.each([0, 0.5, 1, -1])('keeps fractional steps for floats defaulting to %s', (defaultValue) => {
    const inlet = { type: 'float', defaultValue } as const;

    expect(getDraggedParameterValue({ inlet, startValue: 0, deltaY: 1 })).toBe(0.01);
    expect(getDraggedParameterValue({ inlet, startValue: 1, deltaY: -1 })).toBe(0.99);
    expect(getDraggedParameterValue({ inlet, startValue: 2, deltaY: 1 })).toBe(2.01);
  });

  it('keeps fractional steps within a unit range without a default', () => {
    const inlet = { type: 'float', minNumber: 0, maxNumber: 1 } as const;

    expect(getDraggedParameterValue({ inlet, startValue: 0, deltaY: 1 })).toBe(0.01);
    expect(getDraggedParameterValue({ inlet, startValue: 1, deltaY: -1 })).toBe(0.99);
  });

  it('uses whole steps when a float or signal constant has no default or bounds', () => {
    expect(getDraggedParameterValue({ inlet: { type: 'float' }, startValue: 440, deltaY: 1 })).toBe(
      441
    );

    expect(
      getDraggedParameterValue({
        inlet: { type: 'signal', acceptsFloat: true },
        startValue: 440,
        deltaY: 1
      })
    ).toBe(441);
  });

  it('adjusts floats and signal constants without floating-point display noise', () => {
    expect(
      getDraggedParameterValue({ inlet: { type: 'float' }, startValue: 0.1, deltaY: 20 })
    ).toBe(0.3);

    expect(
      getDraggedParameterValue({
        inlet: { type: 'signal', acceptsFloat: true, defaultValue: 1 },
        startValue: 1,
        deltaY: -25
      })
    ).toBe(0.75);
  });

  it('respects display precision while retaining finer starting values', () => {
    expect(
      getDraggedParameterValue({
        inlet: { type: 'float', precision: 1 },
        startValue: 0.5,
        deltaY: 2
      })
    ).toBe(0.7);

    expect(
      getDraggedParameterValue({
        inlet: { type: 'float', maxPrecision: 4 },
        startValue: 0.1234,
        deltaY: 1
      })
    ).toBe(0.1334);
  });

  it('clamps to inlet bounds', () => {
    const inlet = { type: 'float', minNumber: 0, maxNumber: 1 } as const;

    expect(getDraggedParameterValue({ inlet, startValue: 0.5, deltaY: -100 })).toBe(0);
    expect(getDraggedParameterValue({ inlet, startValue: 0.5, deltaY: 100 })).toBe(1);
  });

  it('rejects disallowed options and values rejected by custom validators', () => {
    const inlet = { type: 'int', options: [1, 3] } as const;

    expect(
      getDraggedParameterValue({ inlet: { ...inlet, options: [1, 3] }, startValue: 1, deltaY: 1 })
    ).toBeNull();

    expect(
      getDraggedParameterValue({
        inlet: { type: 'float', validator: (value) => Number(value) > 0 },
        startValue: 0.1,
        deltaY: -20
      })
    ).toBeNull();
  });

  it('rejects nonfinite results', () => {
    expect(
      getDraggedParameterValue({ inlet: { type: 'float' }, startValue: 1, deltaY: Infinity })
    ).toBeNull();
  });
});
