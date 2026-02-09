import { Type } from '@sinclair/typebox';
import type { ObjectSchema } from './types';
import { schema } from './types';
import { msg } from './helpers';
import { Bang, Run, messages, SetCode } from './common';

// WebGPU compute-specific message schemas
const SetOutputSize = msg('setOutputSize', { size: Type.Number() });
const SetDispatchCount = msg('setDispatchCount', { count: Type.Array(Type.Number()) });

export const wgpuComputeMessages = {
  ...messages,
  setOutputSize: schema(SetOutputSize),
  setDispatchCount: schema(SetDispatchCount)
};

/**
 * Schema for the wgpu.compute (WebGPU compute shader) object.
 */
export const wgpuComputeSchema: ObjectSchema = {
  type: 'wgpu.compute',
  category: 'programming',
  description: 'WebGPU compute shaders for parallel GPU computation',
  inlets: [
    {
      id: 'message',
      description: 'Control and input data',
      messages: [
        { schema: Bang, description: 'Trigger computation' },
        { schema: Run, description: 'Compile the shader' },
        { schema: SetCode, description: 'Update shader code' },
        { schema: Type.Any(), description: 'Typed array input data' }
      ]
    }
  ],
  outlets: [
    {
      id: 'message',
      description: 'Computation results',
      messages: [{ schema: Type.Any(), description: 'Typed array output data' }]
    }
  ],
  tags: ['programming', 'gpu', 'webgpu', 'compute', 'parallel'],
  hasDynamicOutlets: true
};
