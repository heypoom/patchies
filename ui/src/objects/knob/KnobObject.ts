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

export const KNOB_PARAM_INDEX = {
  message: 0,
  value: 1,
  min: 2,
  max: 3,
  defaultValue: 4,
  isFloat: 5,
  step: 6,
  runOnMount: 7
} as const;

export type KnobParamName = keyof typeof KNOB_PARAM_INDEX;

export function getKnobParams(data: {
  params?: unknown[];
  value?: number;
  min?: number;
  max?: number;
  defaultValue?: number;
  isFloat?: boolean;
  step?: number;
  runOnMount?: boolean;
}): unknown[] {
  return [
    null,
    data.params?.[KNOB_PARAM_INDEX.value] ?? data.value ?? 0,
    data.params?.[KNOB_PARAM_INDEX.min] ?? data.min ?? 0,
    data.params?.[KNOB_PARAM_INDEX.max] ?? data.max ?? (data.isFloat ? 1 : 100),
    data.params?.[KNOB_PARAM_INDEX.defaultValue] ?? data.defaultValue ?? data.min ?? 0,
    data.params?.[KNOB_PARAM_INDEX.isFloat] ?? data.isFloat ?? false,
    data.params?.[KNOB_PARAM_INDEX.step] ?? data.step ?? null,
    data.params?.[KNOB_PARAM_INDEX.runOnMount] ?? data.runOnMount ?? true
  ];
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
    },
    { name: 'value', type: 'float', defaultValue: 0, hideInlet: true, hideDocs: true },
    { name: 'min', type: 'float', defaultValue: 0, hideInlet: true, hideDocs: true },
    { name: 'max', type: 'float', defaultValue: 100, hideInlet: true, hideDocs: true },
    { name: 'defaultValue', type: 'float', defaultValue: 0, hideInlet: true, hideDocs: true },
    { name: 'isFloat', type: 'bool', defaultValue: false, hideInlet: true, hideDocs: true },
    { name: 'step', type: 'float', defaultValue: null, hideInlet: true, hideDocs: true },
    { name: 'runOnMount', type: 'bool', defaultValue: true, hideInlet: true, hideDocs: true }
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
    if (this.getBooleanParam('runOnMount', true)) {
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
    return this.getNumberParam('value', this.getDefaultValue());
  }

  private getDefaultValue(): number {
    return this.getNumberParam('defaultValue', this.getNumberParam('min', 0));
  }

  private snapValue(value: number): number {
    return snapControlValue(value, {
      min: this.getNumberParam('min', 0),
      max: this.getNumberParam('max', this.getBooleanParam('isFloat', false) ? 1 : 100),
      step: this.getOptionalNumberParam('step'),
      isFloat: this.getBooleanParam('isFloat', false)
    });
  }

  private setAndSendValue(value: number): void {
    const snapped = this.snapValue(value);

    this.setValue(snapped);
    this.context.send(snapped);
  }

  private setValue(value: number): void {
    this.context.setParam('value', value, { notifyUI: true });
  }

  private setConfigParam(name: KnobParamName, value: unknown): void {
    this.context.setParam(name, value, { notifyUI: true });
  }

  private getNumberParam(name: KnobParamName, fallback: number): number {
    const value = this.context.getParam(name);

    return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
  }

  private getOptionalNumberParam(name: KnobParamName): number | undefined {
    const value = this.context.getParam(name);

    return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
  }

  private getBooleanParam(name: KnobParamName, fallback: boolean): boolean {
    const value = this.context.getParam(name);

    return typeof value === 'boolean' ? value : fallback;
  }
}
