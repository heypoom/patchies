import { Type } from '@sinclair/typebox';
import type { ObjectSchema } from './types';

/**
 * Schema for the python (Python code environment) object.
 */
export const pythonSchema: ObjectSchema = {
  type: 'python',
  category: 'programming',
  description: 'Run Python code directly in the browser using Pyodide',
  inlets: [
    {
      id: 'message',
      description: 'Data input',
      messages: [{ schema: Type.Any(), description: 'Data received in Python' }]
    }
  ],
  outlets: [
    {
      id: 'message',
      description: 'Output',
      messages: [{ schema: Type.Any(), description: 'Data sent from Python' }]
    }
  ],
  tags: ['programming', 'python', 'pyodide', 'scripting', 'data'],
  hasDynamicOutlets: true
};
