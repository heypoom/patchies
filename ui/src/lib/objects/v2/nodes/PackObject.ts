import { Type } from '@sinclair/typebox';
import { match } from 'ts-pattern';
import { schema } from '$lib/objects/schemas/types';

import type { ObjectContext } from '../ObjectContext';
import type { ObjectInlet, ObjectOutlet } from '../object-metadata';
import type { MessageMeta, TextObjectV2 } from '../interfaces/text-objects';

type PackSlotType = 'float' | 'symbol' | 'any';

type PackSlot = {
  type: PackSlotType;
  value: unknown;
};

const isBang = (data: unknown) =>
  typeof data === 'object' &&
  data !== null &&
  'type' in data &&
  (data as Record<string, unknown>).type === 'bang';

const matchers = {
  number: schema(Type.Number()),
  string: schema(Type.String()),
  symbol: schema(Type.Symbol()),
  typedMessage: schema(Type.Object({ type: Type.String() })),
  floatArg: schema(Type.Union([Type.Literal('float'), Type.Literal('f')])),
  symbolArg: schema(Type.Union([Type.Literal('symbol'), Type.Literal('s')])),
  anyArg: schema(Type.Union([Type.Literal('any'), Type.Literal('a')]))
};

const toSymbol = (data: unknown): string | symbol | undefined =>
  match(data)
    .with(matchers.string, (value) => value)
    .with(matchers.symbol, (value) => value)
    .with(matchers.typedMessage, (value) => value.type)
    .otherwise((value) => String(value));

const isValidValue = (slot: PackSlot, data: unknown) =>
  match(slot.type)
    .with('float', () => typeof data === 'number')
    .with('symbol', () => true)
    .with('any', () => true)
    .exhaustive();

const formatPackValue = (slot: PackSlot, value: unknown): string | null =>
  match(slot.type)
    .with('symbol', () => (value === '' ? 's' : String(value)))
    .with('any', () => 'a')
    .otherwise(() => null);

const createSlot = (param: unknown): PackSlot | null =>
  match(param)
    .with(matchers.number, (value) => ({ type: 'float' as const, value }))
    .with(matchers.string, (value) => {
      const normalized = value.toLowerCase();

      return match(normalized)
        .with(matchers.floatArg, () => ({ type: 'float' as const, value: 0 }))
        .with(matchers.symbolArg, () => ({ type: 'symbol' as const, value: '' }))
        .with(matchers.anyArg, () => ({ type: 'any' as const, value: null }))
        .otherwise(() => {
          const numericValue = Number(value);

          return Number.isNaN(numericValue)
            ? null
            : { type: 'float' as const, value: numericValue };
        });
    })
    .otherwise(() => null);

/**
 * PackObject collects stored inlet values into one list.
 * Similar to Pure Data's [pack] object.
 *
 * - Creation params define inlet types: float/f, symbol/s, any/a, or numeric float defaults.
 * - Inlet 0 is hot: value updates output the packed list, bang repeats the current list.
 * - Later inlets are cold: value updates only change stored values.
 */
export class PackObject implements TextObjectV2 {
  static type = 'pack';
  static description = 'Pack multiple inlet values into one list';
  static tags = ['pack', 'list', 'routing'];

  static inlets: ObjectInlet[] = [
    {
      name: '0',
      type: 'float',
      description: 'Stored float value 0',
      defaultValue: 0,
      hot: true
    },
    { name: '1', type: 'float', description: 'Stored float value 1', defaultValue: 0 }
  ];

  static outlets: ObjectOutlet[] = [
    { name: 'list', type: 'message', description: 'Packed list output' }
  ];

  readonly nodeId: string;
  readonly context: ObjectContext;

  private slots: PackSlot[] = [
    { type: 'float', value: 0 },
    { type: 'float', value: 0 }
  ];

  constructor(nodeId: string, context: ObjectContext) {
    this.nodeId = nodeId;
    this.context = context;
  }

  create(params: unknown[]): void {
    if (params.length > 0) {
      const slots = params.map(createSlot).filter((slot): slot is PackSlot => slot !== null);

      this.slots = slots.length > 0 ? slots : this.slots;
    }

    this.context.truncateParams(this.slots.length);

    this.slots.forEach((slot, index) => {
      this.context.setParam(index, slot.value);
    });
  }

  onMessage(data: unknown, meta: MessageMeta): void {
    const inlet = meta.inlet ?? 0;
    const slot = this.slots[inlet];

    if (!slot) return;

    if (inlet === 0 && isBang(data)) {
      this.output();
      return;
    }

    const value = this.coerceValue(slot, data);
    if (value === undefined) return;

    slot.value = value;
    this.context.setParam(inlet, value, { notifyUI: slot.type !== 'any' });

    if (inlet === 0) {
      this.output();
    }
  }

  getInlets(): ObjectInlet[] {
    return this.slots.map((slot, index) => ({
      name: String(index),
      type: slot.type,
      description: `Stored ${slot.type} value ${index}`,
      defaultValue: slot.value,
      hot: index === 0,
      formatter:
        slot.type === 'float' ? undefined : (value: unknown) => formatPackValue(slot, value),
      validator:
        index === 0 || slot.type === 'symbol'
          ? (data) => isBang(data) || isValidValue(slot, data)
          : undefined
    }));
  }

  private coerceValue(slot: PackSlot, data: unknown): unknown {
    return match(slot.type)
      .with('float', () => (typeof data === 'number' ? data : undefined))
      .with('symbol', () => toSymbol(data))
      .with('any', () => data)
      .exhaustive();
  }

  private output(): void {
    this.context.send(this.slots.map((slot) => slot.value));
  }
}
