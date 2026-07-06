import { Type } from '@sinclair/typebox';
import { match } from 'ts-pattern';

import type { ObjectContext } from '$lib/objects/v2/ObjectContext';
import type { ObjectInlet, ObjectOutlet } from '$lib/objects/v2/object-metadata';
import type { MessageMeta, TextObjectV2 } from '$lib/objects/v2/interfaces/text-objects';
import { schema } from '$lib/objects/schemas/types';

type NumericOperation = (value: number, operand: number) => number;

const numericOperatorMessages = {
  number: schema(Type.Number())
};

const numericOperatorInlets: ObjectInlet[] = [
  {
    name: 'value',
    type: 'message',
    description: 'Number to transform',
    hot: true,
    hideTextParam: true,
    messages: [{ schema: Type.Number(), description: 'Apply the operator to this number' }]
  },
  {
    name: 'operand',
    type: 'float',
    description: 'Right operand',
    defaultValue: 0,
    maxPrecision: 4
  }
];

const numericOperatorOutlets: ObjectOutlet[] = [
  { name: 'out', type: 'float', description: 'Computed value output' }
];

abstract class NumericOperatorObject implements TextObjectV2 {
  static inlets = numericOperatorInlets;
  static outlets = numericOperatorOutlets;
  static tags = ['math', 'numeric', 'control'];

  readonly nodeId: string;
  readonly context: ObjectContext;

  protected abstract operate: NumericOperation;

  constructor(nodeId: string, context: ObjectContext) {
    this.nodeId = nodeId;
    this.context = context;
  }

  create(params: unknown[]): void {
    this.setOperand(params[0], false);
  }

  onMessage(data: unknown, meta: MessageMeta): void {
    match([meta.inletName, data])
      .with(['value', numericOperatorMessages.number], ([, value]) => {
        this.context.send(this.operate(value, this.getOperand()));
      })
      .with(['operand', numericOperatorMessages.number], ([, value]) => {
        this.setOperand(value, true);
      })
      .otherwise(() => {});
  }

  private setOperand(value: unknown, notifyUI: boolean): void {
    const operand = Number(value);

    if (value !== undefined && Number.isFinite(operand)) {
      this.context.setParam('operand', operand, { notifyUI });
    }
  }

  private getOperand(): number {
    const operand = this.context.getParam('operand');

    return typeof operand === 'number' && Number.isFinite(operand) ? operand : 0;
  }
}

export class AddObject extends NumericOperatorObject {
  static type = '+';
  static description = 'Add a number to incoming values';
  static tags = ['math', 'add', 'sum', 'control'];

  protected operate = (value: number, operand: number) => value + operand;
}

export class SubtractObject extends NumericOperatorObject {
  static type = '-';
  static description = 'Subtract a number from incoming values';
  static tags = ['math', 'subtract', 'difference', 'control'];

  protected operate = (value: number, operand: number) => value - operand;
}

export class MultiplyObject extends NumericOperatorObject {
  static type = '*';
  static description = 'Multiply incoming values by a number';
  static tags = ['math', 'multiply', 'product', 'control'];

  protected operate = (value: number, operand: number) => value * operand;
}

export class DivideObject extends NumericOperatorObject {
  static type = '/';
  static description = 'Divide incoming values by a number';
  static tags = ['math', 'divide', 'quotient', 'control'];

  protected operate = (value: number, operand: number) => (operand === 0 ? 0 : value / operand);
}
