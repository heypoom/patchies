import { Type } from '@sinclair/typebox';
import type { ObjectSchema } from './types';

/**
 * Schema for the fft~ (FFT analysis) object.
 */
export const fftSchema: ObjectSchema = {
  type: 'fft~',
  category: 'audio',
  description: 'Analyzes audio signals and provides frequency and amplitude data',
  inlets: [
    {
      id: 'audio',
      description: 'Audio input to analyze'
    },
    {
      id: 'fftSize',
      description: 'FFT bin size',
      messages: [
        {
          schema: Type.Number(),
          description: 'Size of the FFT bin (power of 2, from 32 to 32768)'
        }
      ]
    }
  ],
  outlets: [
    {
      id: 'analysis',
      description: 'FFT analysis data output'
    }
  ],
  tags: ['audio', 'analysis', 'fft', 'spectrum', 'frequency']
};
