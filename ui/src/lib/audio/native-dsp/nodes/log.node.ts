import { createWorkletDspNode } from '../create-worklet-dsp-node';
import workletUrl from '../processors/log.processor?worker&url';

export const LogNode = createWorkletDspNode({
  type: 'log~',
  group: 'processors',
  description: 'Natural logarithm of signal',

  workletUrl,

  audioInlets: 1,
  audioOutlets: 1,

  inlets: [{ name: 'signal', type: 'signal', description: 'Audio input (positive values)' }],

  outlets: [{ name: 'out', type: 'signal', description: 'Natural log output' }],

  tags: ['audio', 'math', 'log', 'logarithm', 'signal']
});
