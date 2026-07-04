import type { ObjectInlet } from '$lib/objects/v2/object-metadata';

const signalInlet = (description = 'Audio input'): ObjectInlet => ({
  name: 'in',
  type: 'signal',
  description
});

const floatInlet = (
  name: string,
  defaultValue: number,
  description: string,
  extra: Partial<ObjectInlet> = {}
): ObjectInlet => ({
  name,
  type: 'float',
  description,
  defaultValue,
  ...extra
});

const biquadFrequencyInlet = (description: string): ObjectInlet =>
  floatInlet('frequency', 1000, description, {
    isAudioParam: true,
    minNumber: 0,
    maxNumber: 22050,
    maxPrecision: 1
  });

const biquadQInlet = (description: string): ObjectInlet =>
  floatInlet('Q', 1, description, {
    isAudioParam: true,
    minNumber: 0.0001,
    maxNumber: 1000,
    maxPrecision: 2
  });

const biquadGainInlet = (): ObjectInlet =>
  floatInlet('gain', 0, 'Gain in dB', {
    isAudioParam: true,
    minNumber: -40,
    maxNumber: 40,
    maxPrecision: 1
  });

export const VIRTUAL_AUDIO_PROCESSOR_INLETS = new Map<string, ObjectInlet[]>([
  [
    'allpass~',
    [
      signalInlet('Signal to filter'),
      biquadFrequencyInlet('Center frequency in Hz'),
      biquadQInlet('Quality factor')
    ]
  ],
  [
    'bandpass~',
    [
      signalInlet('Signal to filter'),
      biquadFrequencyInlet('Center frequency in Hz'),
      biquadQInlet('Quality factor (bandwidth)')
    ]
  ],
  [
    'compressor~',
    [
      signalInlet('Signal to compress'),
      floatInlet('threshold', -24, 'The decibel value above which compression starts', {
        isAudioParam: true,
        minNumber: -200,
        maxNumber: 0,
        maxPrecision: 1
      }),
      floatInlet('knee', 30, 'Decibel range above threshold for smooth transition', {
        isAudioParam: true,
        minNumber: 0,
        maxNumber: 40,
        maxPrecision: 1
      }),
      floatInlet('ratio', 12, 'Amount of dB change in input for 1 dB change in output', {
        isAudioParam: true,
        minNumber: 0,
        maxNumber: 20,
        maxPrecision: 1
      }),
      floatInlet('attack', 0.003, 'Time in seconds to reduce gain by 10dB', {
        isAudioParam: true,
        minNumber: 0,
        maxNumber: 1,
        maxPrecision: 4
      }),
      floatInlet('release', 0.25, 'Time in seconds to increase gain by 10dB', {
        isAudioParam: true,
        minNumber: 0,
        maxNumber: 1,
        maxPrecision: 4
      })
    ]
  ],
  [
    'delay~',
    [signalInlet(), floatInlet('time', 0, 'Delay time in milliseconds', { isAudioParam: true })]
  ],
  [
    'gain~',
    [
      signalInlet(),
      floatInlet('gain', 1, 'Gain control', {
        isAudioParam: true,
        maxPrecision: 3
      })
    ]
  ],
  [
    'highpass~',
    [
      signalInlet('Signal to filter'),
      biquadFrequencyInlet('Cutoff frequency in Hz'),
      biquadQInlet('Quality factor (resonance)')
    ]
  ],
  [
    'highshelf~',
    [
      signalInlet('Signal to filter'),
      biquadFrequencyInlet('Cutoff frequency in Hz'),
      biquadGainInlet()
    ]
  ],
  [
    'lowpass~',
    [
      signalInlet('Signal to filter'),
      biquadFrequencyInlet('Cutoff frequency in Hz'),
      biquadQInlet('Quality factor (resonance)')
    ]
  ],
  [
    'lowshelf~',
    [
      signalInlet('Signal to filter'),
      biquadFrequencyInlet('Cutoff frequency in Hz'),
      biquadGainInlet()
    ]
  ],
  [
    'notch~',
    [signalInlet(), biquadFrequencyInlet('Center frequency'), biquadQInlet('Width of the notch')]
  ],
  [
    'osc~',
    [
      floatInlet('frequency', 440, 'Oscillator frequency in hertz', {
        isAudioParam: true,
        maxPrecision: 2
      }),
      {
        name: 'type',
        type: 'string',
        description: 'Type of oscillator',
        defaultValue: 'sine',
        options: ['sine', 'square', 'sawtooth', 'triangle']
      },
      floatInlet('detune', 0, 'Detune amount in cents', { isAudioParam: true })
    ]
  ],
  [
    'peaking~',
    [
      signalInlet('Signal to filter'),
      biquadFrequencyInlet('Center frequency in Hz'),
      biquadQInlet('Quality factor (width of peak)'),
      biquadGainInlet()
    ]
  ]
]);
