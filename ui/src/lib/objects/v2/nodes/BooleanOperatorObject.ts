import { Type } from '@sinclair/typebox';
import { match, P } from 'ts-pattern';

import type { ObjectContext } from '../ObjectContext';
import type { ObjectInlet, ObjectOutlet } from '../object-metadata';
import type { MessageMeta, TextObjectV2 } from '../interfaces/text-objects';
import { isTruthyControlValue } from '../truthiness';
import { Bang, messages } from '$lib/objects/schemas/common';

type BinaryOperation = (value: unknown, operand: unknown) => boolean;
type UnaryOperation = (value: unknown) => boolean;

const binaryOperatorInlets: ObjectInlet[] = [
  {
    name: 'value',
    type: 'message',
    description: 'Left operand',
    hot: true,
    hideTextParam: true,
    messages: [
      { schema: Type.Any(), description: 'Evaluate the operator with this value' },
      { schema: Bang, description: 'Re-emit using the previous left operand' }
    ]
  },
  {
    name: 'operand',
    type: 'message',
    description: 'Right operand',
    defaultValue: false,
    messages: [{ schema: Type.Any(), description: 'Store the right operand' }]
  }
];

const unaryOperatorInlets: ObjectInlet[] = [
  {
    name: 'value',
    type: 'message',
    description: 'Input value',
    hot: true,
    hideTextParam: true,
    messages: [
      { schema: Type.Any(), description: 'Evaluate the operator with this value' },
      { schema: Bang, description: 'Re-emit using the previous input value' }
    ]
  }
];

const booleanOperatorOutlets: ObjectOutlet[] = [
  { name: 'out', type: 'bool', description: 'Boolean result output' }
];

abstract class BinaryBooleanOperatorObject implements TextObjectV2 {
  static inlets = binaryOperatorInlets;
  static outlets = booleanOperatorOutlets;
  static tags = ['logic', 'boolean', 'conditional', 'control'];

  readonly nodeId: string;
  readonly context: ObjectContext;

  protected abstract operate: BinaryOperation;

  constructor(nodeId: string, context: ObjectContext) {
    this.nodeId = nodeId;
    this.context = context;
  }

  create(params: unknown[]): void {
    if (params.length > 0) {
      this.context.setParam('operand', params[0], { notifyUI: false });
    }
  }

  onMessage(data: unknown, meta: MessageMeta): void {
    match([meta.inletName, data])
      .with(['value', messages.bang], () => {
        this.context.send(
          this.operate(this.context.getParam('value'), this.context.getParam('operand'))
        );
      })
      .with(['value', P.any], ([, value]) => {
        this.context.setParam('value', value, { notifyUI: true });
        this.context.send(this.operate(value, this.context.getParam('operand')));
      })
      .with(['operand', P.any], () => {
        this.context.setParam('operand', data, { notifyUI: true });
      })
      .otherwise(() => {});
  }
}

abstract class UnaryBooleanOperatorObject implements TextObjectV2 {
  static inlets = unaryOperatorInlets;
  static outlets = booleanOperatorOutlets;
  static tags = ['logic', 'boolean', 'conditional', 'control'];

  readonly nodeId: string;
  readonly context: ObjectContext;

  protected abstract operate: UnaryOperation;

  constructor(nodeId: string, context: ObjectContext) {
    this.nodeId = nodeId;
    this.context = context;
  }

  onMessage(data: unknown, meta: MessageMeta): void {
    match([meta.inletName, data])
      .with(['value', messages.bang], () => {
        this.context.send(this.operate(this.context.getParam('value')));
      })
      .with(['value', P.any], ([, value]) => {
        this.context.setParam('value', value, { notifyUI: true });
        this.context.send(this.operate(value));
      })
      .otherwise(() => {});
  }
}

export class AndObject extends BinaryBooleanOperatorObject {
  static type = '&&';
  static aliases = ['and'];
  static description = 'Output true when both operands are true';
  static tags = ['logic', 'boolean', 'and', 'conditional', 'control'];

  protected operate = (value: unknown, operand: unknown) =>
    isTruthyControlValue(value) && isTruthyControlValue(operand);
}

export class OrObject extends BinaryBooleanOperatorObject {
  static type = '||';
  static aliases = ['or'];
  static description = 'Output true when either operand is true';
  static tags = ['logic', 'boolean', 'or', 'conditional', 'control'];

  protected operate = (value: unknown, operand: unknown) =>
    isTruthyControlValue(value) || isTruthyControlValue(operand);
}

export class NotObject extends UnaryBooleanOperatorObject {
  static type = '!';
  static aliases = ['not'];
  static description = 'Output the inverse of the input truthiness';
  static tags = ['logic', 'boolean', 'not', 'conditional', 'control'];

  protected operate = (value: unknown) => !isTruthyControlValue(value);
}

export class EqualObject extends BinaryBooleanOperatorObject {
  static type = '==';
  static aliases = ['eq'];
  static description = 'Output true when both operands are strictly equal';
  static tags = ['logic', 'boolean', 'equal', 'conditional', 'control'];

  protected operate = (value: unknown, operand: unknown) => value === operand;
}

export class NotEqualObject extends BinaryBooleanOperatorObject {
  static type = '!=';
  static aliases = ['neq'];
  static description = 'Output true when operands are not strictly equal';
  static tags = ['logic', 'boolean', 'not-equal', 'conditional', 'control'];

  protected operate = (value: unknown, operand: unknown) => value !== operand;
}

export class LessThanObject extends BinaryBooleanOperatorObject {
  static type = '<';
  static aliases = ['lt'];
  static description = 'Output true when the left number is less than the right number';
  static tags = ['logic', 'boolean', 'less-than', 'conditional', 'control'];

  protected operate = (value: unknown, operand: unknown) => Number(value) < Number(operand);
}

export class LessThanOrEqualObject extends BinaryBooleanOperatorObject {
  static type = '<=';
  static aliases = ['lte'];
  static description = 'Output true when the left number is less than or equal to the right number';
  static tags = ['logic', 'boolean', 'less-than-or-equal', 'conditional', 'control'];

  protected operate = (value: unknown, operand: unknown) => Number(value) <= Number(operand);
}

export class GreaterThanObject extends BinaryBooleanOperatorObject {
  static type = '>';
  static aliases = ['gt'];
  static description = 'Output true when the left number is greater than the right number';
  static tags = ['logic', 'boolean', 'greater-than', 'conditional', 'control'];

  protected operate = (value: unknown, operand: unknown) => Number(value) > Number(operand);
}

export class GreaterThanOrEqualObject extends BinaryBooleanOperatorObject {
  static type = '>=';
  static aliases = ['gte'];
  static description =
    'Output true when the left number is greater than or equal to the right number';
  static tags = ['logic', 'boolean', 'greater-than-or-equal', 'conditional', 'control'];

  protected operate = (value: unknown, operand: unknown) => Number(value) >= Number(operand);
}
