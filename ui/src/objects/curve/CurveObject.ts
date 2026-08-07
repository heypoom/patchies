import { Type } from '@sinclair/typebox';
import { match } from 'ts-pattern';

import type { ObjectContext } from '$lib/objects/v2/ObjectContext';
import type { TextObjectV2 } from '$lib/objects/v2/interfaces/text-objects';
import type { ObjectInlet, ObjectOutlet } from '$lib/objects/v2/object-metadata';
import { Bang, Reset, messages } from '$lib/objects/schemas/common';
import { schema } from '$lib/objects/schemas/types';

import { CURVE_DEFAULT_POINTS, type CurveMode, type CurvePoint } from './constants';
import { evaluate } from './utils';

export const CurveFloat = Type.Number();
export const CurveList = Type.Array(Type.Number(), { minItems: 4 });

const curveMessages = {
  float: schema(CurveFloat),
  list: schema(CurveList)
};

export type CurveData = {
  points?: CurvePoint[];
  mode?: CurveMode;
  locked?: boolean;
};

type ResolvedCurveData = {
  points: CurvePoint[];
  mode: CurveMode;
  locked: boolean;
};

export function getCurveData(data: CurveData): ResolvedCurveData {
  return {
    points: data.points ?? CURVE_DEFAULT_POINTS,
    mode: data.mode ?? 'linear',
    locked: data.locked ?? false
  };
}

export class CurveObject implements TextObjectV2 {
  static type = 'curve';
  static category = 'control';
  static description = 'Interactive breakpoint/curve editor';
  static tags = ['control', 'curve', 'breakpoint', 'function', 'interpolation', 'mapping'];

  static inlets: ObjectInlet[] = [
    {
      name: 'message',
      type: 'message',
      description: 'x input (float) or bang / reset / list',
      messages: [
        { schema: CurveFloat, description: 'Evaluate the function at X, output Y' },
        { schema: Bang, description: 'Output the full breakpoint list as [x1, y1, x2, y2, ...]' },
        {
          schema: CurveList,
          description: 'Set breakpoints from a flat list (minimum 2 pairs, must be even length)'
        },
        { schema: Reset, description: 'Reset to default: flat line at y=0.5' }
      ],
      handle: { handleType: 'message' }
    }
  ];

  static outlets: ObjectOutlet[] = [
    {
      name: 'message',
      type: 'message',
      description: 'y output',
      messages: [
        { schema: CurveFloat, description: 'Interpolated Y value at the given X' },
        {
          schema: CurveList,
          description: 'Full breakpoint list [x1, y1, x2, y2, ...] when queried with bang'
        }
      ],
      handle: { handleType: 'message' }
    }
  ];

  constructor(
    readonly nodeId: string,
    readonly context: ObjectContext
  ) {}

  onMessage(message: unknown): void {
    match(message)
      .with(curveMessages.float, (x) => {
        const { mode, points } = this.getData();
        this.context.send(evaluate(mode, x, points));
      })
      .with(messages.bang, () => {
        this.context.send(this.getData().points.flatMap((point) => [point.x, point.y]));
      })
      .with(messages.reset, () => {
        this.setPoints(CURVE_DEFAULT_POINTS.map((point) => ({ ...point })));
      })
      .with(curveMessages.list, (values) => {
        if (values.length % 2 !== 0) return;

        const points: CurvePoint[] = [];
        for (let index = 0; index < values.length; index += 2) {
          points.push({
            x: Math.max(0, Math.min(1, values[index])),
            y: Math.max(0, Math.min(1, values[index + 1]))
          });
        }

        this.setPoints(points.sort((left, right) => left.x - right.x));
      })
      .otherwise(() => {});
  }

  private setPoints(points: CurvePoint[]): void {
    this.context.setData({ points }, { notifyUI: true });
  }

  private getData(): ResolvedCurveData {
    return getCurveData(this.context.getData<CurveData>());
  }
}
