import { Type } from '@sinclair/typebox';
import type { ObjectSchema } from './types';
import { msg, sym } from './helpers';
import { Bang, LoadBySrc } from './common';

// Table-specific message schemas
export const TableSet = msg('set', { index: Type.Number(), value: Type.Number() });
export const TableGet = msg('get', { index: Type.Number() });
export const TableGetResult = msg('get', { index: Type.Number(), value: Type.Number() });
export const TableResize = msg('resize', { length: Type.Number() });
export const TableClear = sym('clear');
export const TableNormalize = sym('normalize');
export { LoadBySrc as TableLoad } from './common';

/**
 * Schema for the table object — named float array with waveform visualizer.
 */
export const tableSchema: ObjectSchema = {
  type: 'table',
  category: 'audio',
  description: 'Named array of floats — shared with tabread~, tabwrite~, tabosc4~',
  inlets: [
    {
      id: 'command',
      description: 'Table commands',
      messages: [
        {
          schema: Bang,
          description: 'Output the entire table as a Float32Array'
        },
        {
          schema: TableSet,
          description: 'Set value at index'
        },
        {
          schema: TableGet,
          description: 'Get value at index — outputs {type:"get", index, value}'
        },
        {
          schema: TableResize,
          description: 'Resize the table (preserves data up to new length)'
        },
        {
          schema: TableClear,
          description: 'Fill the table with zeros'
        },
        {
          schema: TableNormalize,
          description: 'Normalize table values to -1..1 range'
        },
        {
          schema: LoadBySrc,
          description: 'Load audio from a VFS path or URL into the buffer'
        },
        {
          schema: Type.Unsafe<Float32Array>({ type: 'Float32Array' }),
          description: 'Write a Float32Array directly into the buffer'
        },
        {
          schema: Type.Array(Type.Number()),
          description: 'Write an array of floats into the buffer'
        }
      ]
    }
  ],
  outlets: [
    {
      id: 'result',
      description: 'Table data output',
      messages: [
        {
          schema: Type.Unsafe<Float32Array>({ type: 'Float32Array' }),
          description: 'Entire table contents as Float32Array (on bang)'
        },
        {
          schema: TableGetResult,
          description: 'Value at index (on get command)'
        }
      ]
    }
  ],
  tags: ['audio', 'buffer', 'array', 'wavetable', 'sample']
};
