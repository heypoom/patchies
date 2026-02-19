import { createWorkletDspNode } from '../create-worklet-dsp-node';
import workletUrl from '../processors/exp.processor?worker&url';

export const ExpNode = createWorkletDspNode({
  type: 'exp~',
  group: 'processors',
  description: 'Exponential function (e^x)',

  workletUrl,

  audioInlets: 1,
  audioOutlets: 1,

  inlets: [{ name: 'signal', type: 'signal', description: 'Exponent value' }],

  outlets: [{ name: 'out', type: 'signal', description: 'e^x output' }],

  tags: ['audio', 'math', 'exp', 'exponential', 'signal']
});
