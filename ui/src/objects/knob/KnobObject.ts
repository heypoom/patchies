import { Type } from '@sinclair/typebox';
import { match } from 'ts-pattern';

import type { ObjectContext } from '$lib/objects/v2/ObjectContext';
import type { MessageMeta, TextObjectV2 } from '$lib/objects/v2/interfaces/text-objects';
import type { ObjectInlet, ObjectOutlet } from '$lib/objects/v2/object-metadata';
import { Bang, Reset, SetDefault, SetMax, SetMin, SetValue, messages } from '$lib/objects/schemas';
import { schema } from '$lib/objects/schemas/types';
import { snapControlValue } from '$lib/utils/stepped-control';

const NumberControl = Type.Number();

const knobMessages = {
  numberControl: schema(NumberControl)
};

export type KnobData = {
  value?: number;
  min?: number;
  max?: number;
  defaultValue?: number;
  isFloat?: boolean;
  step?: number | null;
  runOnMount?: boolean;
};

export function getKnobData(data: {
  value?: unknown;
  min?: unknown;
  max?: unknown;
  defaultValue?: unknown;
  isFloat?: unknown;
  step?: unknown;
  runOnMount?: unknown;
}): KnobData {
  const value = getNumber(data.value, 0);
  const min = getNumber(data.min, 0);
  const isFloat = data.isFloat === true;

  return {
    value,
    min,
    max: getNumber(data.max, isFloat ? 1 : 100),
    defaultValue: getNumber(data.defaultValue, min),
    isFloat,
    step: getOptionalNumber(data.step),
    runOnMount: getBoolean(data.runOnMount, true)
  };
}

function getNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function getOptionalNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function getBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

export class KnobObject implements TextObjectV2 {
  static type = 'knob';
  static category = 'interface';
  static description = 'Circular encoder knob for continuous value control (0-1 by default)';
  static tags = ['interface', 'control', 'number', 'encoder', 'input'];

  static inlets: ObjectInlet[] = [
    {
      name: 'message',
      type: 'message',
      description: 'Control messages',
      messages: [
        { schema: Bang, description: 'Output the current knob value' },
        { schema: Reset, description: 'Reset the knob value back to its default' },
        { schema: NumberControl, description: 'Set knob to value and output' },
        { schema: SetMin, description: 'Set the minimum bound' },
        { schema: SetMax, description: 'Set the maximum bound' },
        { schema: SetDefault, description: 'Set the default value (used by reset)' },
        { schema: SetValue, description: 'Set value silently without triggering output' }
      ],
      handle: { handleType: 'message' }
    }
  ];

  static outlets: ObjectOutlet[] = [
    {
      name: 'message',
      type: 'float',
      description: 'Knob output',
      messages: [{ schema: Type.Number(), description: 'Current knob value' }],
      handle: { handleType: 'message' }
    }
  ];

  private runOnMountTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    readonly nodeId: string,
    readonly context: ObjectContext
  ) {}

  create(): void {
    if (this.getData().runOnMount ?? true) {
      this.runOnMountTimer = setTimeout(() => this.context.send(this.getValue()), 100);
    }
  }

  destroy(): void {
    if (this.runOnMountTimer) {
      clearTimeout(this.runOnMountTimer);
    }
  }

  onMessage(data: unknown, meta: MessageMeta): void {
    const inletName = meta.inletName ?? 'message';

    match([inletName, data])
      .with(['message', knobMessages.numberControl], ([, value]) => {
        this.setAndSendValue(value);
      })
      .with(['message', messages.reset], () => {
        this.setAndSendValue(this.getDefaultValue());
      })
      .with(['message', messages.bang], () => {
        this.context.send(this.getValue());
      })
      .with(['message', messages.setMin], ([, { value }]) => {
        this.setConfigParam('min', value);
        this.setValue(this.snapValue(this.getValue()));
      })
      .with(['message', messages.setMax], ([, { value }]) => {
        this.setConfigParam('max', value);
        this.setValue(this.snapValue(this.getValue()));
      })
      .with(['message', messages.setDefault], ([, { value }]) => {
        this.setConfigParam('defaultValue', value);
      })
      .with(['message', messages.setValue], ([, { value }]) => {
        this.setValue(this.snapValue(value));
      })
      .otherwise(() => {});
  }

  private getValue(): number {
    return this.getData().value ?? this.getDefaultValue();
  }

  private getDefaultValue(): number {
    const data = this.getData();

    return data.defaultValue ?? data.min ?? 0;
  }

  private snapValue(value: number): number {
    const data = this.getData();

    return snapControlValue(value, {
      min: data.min ?? 0,
      max: data.max ?? (data.isFloat ? 1 : 100),
      step: data.step ?? undefined,
      isFloat: data.isFloat ?? false
    });
  }

  private setAndSendValue(value: number): void {
    const snapped = this.snapValue(value);

    this.setValue(snapped);
    this.context.send(snapped);
  }

  private setValue(value: number): void {
    this.context.setData({ value }, { notifyUI: true });
  }

  private setConfigParam(name: keyof KnobData, value: unknown): void {
    this.context.setData({ [name]: value }, { notifyUI: true });
  }

  private getData(): KnobData {
    return getKnobData(this.context.getData());
  }
}
