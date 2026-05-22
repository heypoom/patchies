import { Type } from '@sinclair/typebox';
import { match } from 'ts-pattern';

import type { ObjectContext } from '../ObjectContext';
import type { ObjectInlet, ObjectOutlet } from '../object-metadata';
import type { MessageMeta, TextObjectV2 } from '../interfaces/text-objects';
import { schema } from '$lib/objects/schemas/types';

const scaleMessages = {
  number: schema(Type.Number())
};

/**
 * ScaleObject remaps a number from one range to another.
 * Similar to Max's [scale] object and p5.js map().
 *
 * Usage: `scale inMin inMax outMin outMax`
 */
export class ScaleObject implements TextObjectV2 {
  static type = 'scale';
  static description = 'Remap a number from one range to another';
  static tags = ['math', 'range', 'remap', 'control'];

  static inlets: ObjectInlet[] = [
    {
      name: 'value',
      type: 'message',
      description: 'Value to scale',
      hot: true,
      hideTextParam: true,
      messages: [
        {
          schema: Type.Number(),
          description: 'Scale this number to the target range'
        }
      ]
    },
    {
      name: 'inMin',
      type: 'float',
      description: 'Input range minimum',
      defaultValue: 0
    },
    {
      name: 'inMax',
      type: 'float',
      description: 'Input range maximum',
      defaultValue: 1
    },
    {
      name: 'outMin',
      type: 'float',
      description: 'Output range minimum',
      defaultValue: 0
    },
    {
      name: 'outMax',
      type: 'float',
      description: 'Output range maximum',
      defaultValue: 1
    }
  ];

  static outlets: ObjectOutlet[] = [
    { name: 'out', type: 'float', description: 'Scaled value output' }
  ];

  readonly nodeId: string;
  readonly context: ObjectContext;

  constructor(nodeId: string, context: ObjectContext) {
    this.nodeId = nodeId;
    this.context = context;
  }

  create(params: unknown[]): void {
    this.setInitialParam('inMin', params[0]);
    this.setInitialParam('inMax', params[1]);
    this.setInitialParam('outMin', params[2]);
    this.setInitialParam('outMax', params[3]);
  }

  onMessage(data: unknown, meta: MessageMeta): void {
    match([meta.inletName, data])
      .with(['value', scaleMessages.number], ([, value]) => {
        this.scaleAndSend(value);
      })
      .with(['inMin', scaleMessages.number], ([name, value]) => {
        this.context.setParam(name, value, { notifyUI: true });
      })
      .with(['inMax', scaleMessages.number], ([name, value]) => {
        this.context.setParam(name, value, { notifyUI: true });
      })
      .with(['outMin', scaleMessages.number], ([name, value]) => {
        this.context.setParam(name, value, { notifyUI: true });
      })
      .with(['outMax', scaleMessages.number], ([name, value]) => {
        this.context.setParam(name, value, { notifyUI: true });
      })
      .otherwise(() => {});
  }

  private setInitialParam(name: string, value: unknown): void {
    const numValue = Number(value);

    if (value !== undefined && Number.isFinite(numValue)) {
      this.context.setParam(name, numValue);
    }
  }

  private scaleAndSend(value: number): void {
    const inMin = this.getNumberParam('inMin', 0);
    const inMax = this.getNumberParam('inMax', 1);
    const outMin = this.getNumberParam('outMin', 0);
    const outMax = this.getNumberParam('outMax', 1);

    const inputRange = inMax - inMin;
    if (inputRange === 0) return;

    const scaled = outMin + ((value - inMin) / inputRange) * (outMax - outMin);
    this.context.send(scaled);
  }

  private getNumberParam(name: string, fallback: number): number {
    const value = this.context.getParam(name);

    return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
  }
}
