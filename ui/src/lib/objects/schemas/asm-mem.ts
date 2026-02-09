import { Type } from '@sinclair/typebox';
import type { ObjectSchema } from './types';
import { schema } from './types';
import { sym, msg } from './helpers';
import { Bang, Reset, messages } from './common';

// asm.mem-specific message schemas
const SetRows = msg('setRows', { value: Type.Number() });
const WriteMemory = msg('write', { address: Type.Number(), data: Type.Array(Type.Number()) });
const ReadMemory = msg('read', { address: Type.Number(), count: Type.Number() });
const OverrideMemory = msg('override', { data: Type.Array(Type.Number()) });

/** Pre-wrapped matchers for use with ts-pattern */
export const asmMemMessages = {
  ...messages,
  setRows: schema(SetRows),
  write: schema(WriteMemory),
  read: schema(ReadMemory),
  override: schema(OverrideMemory),
  number: schema(Type.Number()),
  numberArray: schema(Type.Array(Type.Number()))
};

/**
 * Schema for the asm.mem (external memory buffer) object.
 */
export const asmMemSchema: ObjectSchema = {
  type: 'asm.mem',
  category: 'programming',
  description: 'External memory buffer for assembly programs',
  inlets: [
    {
      id: 'message',
      description: 'Control messages and memory operations',
      messages: [
        { schema: Bang, description: 'Output all memory values' },
        { schema: Reset, description: 'Clear all memory values' },
        { schema: SetRows, description: 'Set number of display rows (1-100)' },
        { schema: WriteMemory, description: 'Write values at specific address' },
        { schema: ReadMemory, description: 'Read values and send back to asm' },
        { schema: OverrideMemory, description: 'Replace all memory values' },
        { schema: Type.Number(), description: 'Append single value to memory' },
        { schema: Type.Array(Type.Number()), description: 'Append array of values to memory' }
      ]
    }
  ],
  outlets: [
    {
      id: 'message',
      description: 'Memory output',
      messages: [{ schema: Type.Array(Type.Number()), description: 'All memory values on bang' }]
    }
  ],
  tags: ['programming', 'assembly', 'memory', 'buffer']
};
