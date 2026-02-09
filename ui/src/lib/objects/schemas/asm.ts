import { Type } from '@sinclair/typebox';
import type { ObjectSchema } from './types';
import { schema } from './types';
import { sym } from './helpers';
import { Bang, Run, Stop, Reset, messages, SetCode } from './common';

const Step = sym('step');

export const asmMessages = {
  ...messages,
  step: schema(Step)
};

/**
 * Schema for the asm (virtual stack machine assembly) object.
 */
export const asmSchema: ObjectSchema = {
  type: 'asm',
  category: 'programming',
  description: 'Virtual stack machine assembly interpreter',
  inlets: [
    {
      id: 'message',
      description: 'Control messages and input data',
      messages: [
        { schema: Bang, description: 'Execute next instruction' },
        { schema: Run, description: 'Run program continuously' },
        { schema: Stop, description: 'Stop execution' },
        { schema: Reset, description: 'Reset machine state' },
        { schema: Step, description: 'Execute single instruction' },
        { schema: SetCode, description: 'Set assembly code' },
        { schema: Type.Any(), description: 'Push value to stack' }
      ]
    }
  ],
  outlets: [
    {
      id: 'message',
      description: 'Program output',
      messages: [{ schema: Type.Any(), description: 'Values from output instructions' }]
    }
  ],
  tags: ['programming', 'assembly', 'stack', 'virtual-machine'],
  hasDynamicOutlets: true
};
