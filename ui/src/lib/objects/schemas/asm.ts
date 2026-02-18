import { Type } from '@sinclair/typebox';
import type { ObjectSchema } from './types';
import { schema } from './types';
import { sym, msg, t } from './helpers';
import { Bang, Play, Pause, Run, Toggle, Reset, messages, SetCode } from './common';

// Asm-specific input message schemas
const Step = sym('step');
const SetDelayMs = msg('setDelayMs', { value: Type.Number() });
const SetStepBy = msg('setStepBy', { value: Type.Number() });

// Asm-specific output message schemas
const MemRead = Type.Object({
  type: t('read'),
  address: Type.Number(),
  count: Type.Number()
});

const MemWrite = Type.Object({
  type: t('write'),
  address: Type.Number(),
  data: Type.Array(Type.Number())
});

/** Pre-wrapped matchers for use with ts-pattern */
export const asmMessages = {
  ...messages,
  step: schema(Step),
  setDelayMs: schema(SetDelayMs),
  setStepBy: schema(SetStepBy),
  number: schema(Type.Number()),
  numberArray: schema(Type.Array(Type.Number()))
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
      type: 'message',
      description: 'Control messages and input data',
      messages: [
        { schema: Bang, description: 'Step machine by configured instructions per step' },
        { schema: SetCode, description: 'Set assembly code and reload program' },
        { schema: Run, description: 'Reload program and execute one step' },
        { schema: Play, description: 'Start continuous execution' },
        { schema: Pause, description: 'Pause continuous execution' },
        { schema: Toggle, description: 'Toggle between play and pause' },
        { schema: Reset, description: 'Reset machine state and reload program' },
        { schema: Step, description: 'Execute single step (same as bang)' },
        { schema: SetDelayMs, description: 'Set delay between steps in milliseconds (10-5000)' },
        {
          schema: SetStepBy,
          description: 'Set number of instructions to execute per step (1-1000)'
        },
        { schema: Type.Number(), description: 'Send numeric data to the machine' },
        { schema: Type.Array(Type.Number()), description: 'Send array of numbers to the machine' }
      ]
    }
  ],
  outlets: [
    {
      id: 'output',
      type: 'message',
      description: 'Program output and side effects',
      messages: [
        {
          schema: Type.Number(),
          description: 'Single number from send instruction (e.g. send 0 1)'
        },
        {
          schema: Type.Array(Type.Number()),
          description: 'Array of numbers from send instruction (e.g. send 1 3)'
        },
        {
          schema: MemRead,
          description: 'Read memory from asm.mem'
        },
        {
          schema: MemWrite,
          description: 'Write memory to asm.mem'
        }
      ]
    }
  ],
  tags: ['programming', 'assembly', 'stack', 'virtual-machine']
};
