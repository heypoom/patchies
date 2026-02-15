import { Type } from '@sinclair/typebox';
import type { ObjectSchema } from './types';
import { schema } from './types';
import { msg, sym } from './helpers';
import { Bang, Stop, messages } from './common';

// ChucK-specific message schemas
const Replace = sym('replace');
const Run = sym('run');
const Add = sym('add');
const Remove = sym('remove');
const ClearAll = sym('clearAll');
const ReplaceCode = msg('replace', { code: Type.String() });

// Global variable messages
const SetValue = msg('set', { key: Type.String(), value: Type.Any() });
const SetInt = msg('setInt', { key: Type.String(), value: Type.Number() });
const SetFloat = msg('setFloat', { key: Type.String(), value: Type.Number() });
const SetIntArray = msg('setIntArray', { key: Type.String(), value: Type.Array(Type.Number()) });
const SetFloatArray = msg('setFloatArray', {
  key: Type.String(),
  value: Type.Array(Type.Number())
});
const GetValue = msg('get', { key: Type.String() });
const GetInt = msg('getInt', { key: Type.String() });
const GetFloat = msg('getFloat', { key: Type.String() });
const GetString = msg('getString', { key: Type.String() });
const GetIntArray = msg('getIntArray', { key: Type.String() });
const GetFloatArray = msg('getFloatArray', { key: Type.String() });

// Event messages
const Signal = msg('signal', { event: Type.String() });
const Broadcast = msg('broadcast', { event: Type.String() });
const ListenOnce = msg('listenOnce', { event: Type.String() });
const ListenStart = msg('listenStart', { event: Type.String() });
const ListenStop = msg('listenStop', { event: Type.String() });

// For matching any message with a type field (fallback)
const AnyTypeMessage = Type.Object({ type: Type.String() }, { additionalProperties: true });

/** Pre-wrapped matchers for use with ts-pattern */
export const chuckMessages = {
  ...messages,
  string: schema(Type.String()),
  anyTypeMessage: schema(AnyTypeMessage),
  replace: schema(Replace),
  run: schema(Run),
  add: schema(Add),
  remove: schema(Remove),
  clearAll: schema(ClearAll),
  replaceCode: schema(ReplaceCode),
  setValue: schema(SetValue),
  setInt: schema(SetInt),
  setFloat: schema(SetFloat),
  setIntArray: schema(SetIntArray),
  setFloatArray: schema(SetFloatArray),
  getValue: schema(GetValue),
  getInt: schema(GetInt),
  getFloat: schema(GetFloat),
  getString: schema(GetString),
  getIntArray: schema(GetIntArray),
  getFloatArray: schema(GetFloatArray),
  signal: schema(Signal),
  broadcast: schema(Broadcast),
  listenOnce: schema(ListenOnce),
  listenStart: schema(ListenStart),
  listenStop: schema(ListenStop)
};

/**
 * Schema for the chuck~ (ChucK audio programming) object.
 */
export const chuckSchema: ObjectSchema = {
  type: 'chuck~',
  category: 'audio',
  description: 'ChucK audio programming environment for real-time sound synthesis',
  inlets: [
    {
      id: 'audio',
      type: 'signal',
      description: 'Audio input for processing'
    },
    {
      id: 'message',
      description: 'Control messages',
      messages: [
        { schema: Type.String(), description: 'Add string expression as new shred' },
        { schema: Bang, description: 'Replace most recent shred with current expression' },
        { schema: Replace, description: 'Replace most recent shred' },
        { schema: Run, description: 'Replace most recent shred' },
        { schema: Add, description: 'Add current expression as new shred' },
        { schema: Remove, description: 'Remove the last shred' },
        { schema: Stop, description: 'Stop all shreds' },
        { schema: ClearAll, description: 'Clear all shreds' },
        { schema: ReplaceCode, description: 'Replace most recent shred with given code' },
        { schema: SetValue, description: 'Set global value (string, int, or float)' },
        { schema: SetInt, description: 'Set global integer value' },
        { schema: SetFloat, description: 'Set global float value' },
        { schema: SetIntArray, description: 'Set global integer array' },
        { schema: SetFloatArray, description: 'Set global float array' },
        { schema: GetValue, description: 'Get global value (auto-detects type)' },
        { schema: GetInt, description: 'Get global integer value' },
        { schema: GetFloat, description: 'Get global float value' },
        { schema: GetString, description: 'Get global string value' },
        { schema: GetIntArray, description: 'Get global integer array' },
        { schema: GetFloatArray, description: 'Get global float array' },
        { schema: Signal, description: 'Signal an event by name' },
        { schema: Broadcast, description: 'Broadcast an event by name' },
        { schema: ListenOnce, description: 'Listen for event once' },
        { schema: ListenStart, description: 'Start listening for event continuously' },
        { schema: ListenStop, description: 'Stop listening for event' }
      ]
    }
  ],
  outlets: [
    {
      id: 'message',
      description: 'Console output and event responses',
      messages: [
        { schema: Type.String(), description: 'Console output from <<< print statements' },
        {
          schema: Type.Object({ key: Type.String(), value: Type.Any() }),
          description: 'Response from get* messages'
        },
        {
          schema: Type.Object({ event: Type.String() }),
          description: 'Event triggered notification'
        }
      ]
    }
  ],
  tags: ['audio', 'programming', 'synthesis', 'livecoding', 'webchuck'],
  hasDynamicOutlets: true
};
