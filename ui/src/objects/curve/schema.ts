import { Type } from '@sinclair/typebox';
import { schema, type ObjectSchema } from '$lib/objects/schemas/types';
import { Bang, Reset } from '$lib/objects/schemas/common';

// Raw TypeBox schemas
export const CurveFloat = Type.Number();
export const CurveList = Type.Array(Type.Number());

// ts-pattern matchers
export const curveMessages = {
  float: schema(CurveFloat),
  list: schema(CurveList)
};

export const curveSchema: ObjectSchema = {
  type: 'curve',
  category: 'control',
  description: 'Interactive breakpoint/curve editor',
  inlets: [
    {
      id: 'message',
      description: 'x input (float) or bang / reset / list',
      messages: [
        { schema: CurveFloat, description: 'Evaluate the function at X, output Y' },
        { schema: Bang, description: 'Output the full breakpoint list as [x1, y1, x2, y2, ...]' },
        {
          schema: CurveList,
          description: 'Set breakpoints from a flat list (minimum 2 pairs, must be even length)'
        },
        { schema: Reset, description: 'Reset to default: flat line at y=0.5' }
      ]
    }
  ],
  outlets: [
    {
      id: 'message',
      description: 'y output',
      messages: [
        { schema: CurveFloat, description: 'Interpolated Y value at the given X' },
        {
          schema: CurveList,
          description: 'Full breakpoint list [x1, y1, x2, y2, ...] when queried with bang'
        }
      ]
    }
  ],
  tags: ['control', 'curve', 'breakpoint', 'function', 'interpolation', 'mapping']
};
