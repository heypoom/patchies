import { Type } from '@sinclair/typebox';
import { match, P } from 'ts-pattern';

import type { ObjectContext } from '../ObjectContext';
import type { ObjectInlet, ObjectOutlet } from '../object-metadata';
import type { TextObjectV2, MessageMeta } from '../interfaces/text-objects';

/**
 * AdsrObject generates ADSR envelope messages.
 */
export class AdsrObject implements TextObjectV2 {
  static type = 'adsr';
  static description = 'ADSR envelope generator with trigger and parameter control inlets';

  static inlets: ObjectInlet[] = [
    {
      name: 'trigger',
      type: 'message',
      description: 'Trigger the ADSR envelope. 0 = release, 1 = attack.',
      hot: true,
      messages: [
        {
          schema: Type.Union([Type.Literal(1), Type.Literal(true)]),
          description: 'Trigger attack→decay→sustain'
        },
        {
          schema: Type.Union([Type.Literal(0), Type.Literal(false)]),
          description: 'Trigger release'
        }
      ]
    },
    {
      name: 'peak',
      type: 'float',
      description: 'Peak value',
      defaultValue: 1,
      minNumber: 0,
      maxPrecision: 2,
      messages: [{ schema: Type.Number(), description: 'Peak level (default: 1)' }]
    },
    {
      name: 'attack',
      type: 'float',
      description: 'Attack time in ms',
      defaultValue: 100,
      minNumber: 0,
      precision: 0,
      messages: [{ schema: Type.Number(), description: 'Attack time in ms (default: 100)' }]
    },
    {
      name: 'decay',
      type: 'float',
      description: 'Decay time in ms',
      defaultValue: 200,
      minNumber: 0,
      precision: 0,
      messages: [{ schema: Type.Number(), description: 'Decay time in ms (default: 200)' }]
    },
    {
      name: 'sustain',
      type: 'float',
      description: 'Sustain value',
      defaultValue: 0.5,
      minNumber: 0,
      maxPrecision: 2,
      messages: [{ schema: Type.Number(), description: 'Sustain level (default: 0.5)' }]
    },
    {
      name: 'release',
      type: 'float',
      description: 'Release time in ms',
      defaultValue: 300,
      precision: 0,
      messages: [{ schema: Type.Number(), description: 'Release time in ms (default: 300)' }]
    }
  ];

  static outlets: ObjectOutlet[] = [
    {
      name: 'out',
      type: 'message',
      description: 'ADSR envelope message',
      messages: [{ schema: Type.Any(), description: 'Scheduled parameter messages' }]
    }
  ];

  readonly nodeId: string;
  readonly context: ObjectContext;

  constructor(nodeId: string, context: ObjectContext) {
    this.nodeId = nodeId;
    this.context = context;
  }

  onMessage(data: unknown, meta: MessageMeta): void {
    match([meta.inletName, data])
      .with(['trigger', P.union(0, false)], () => this.sendRelease())
      .with(['trigger', P.any], () => this.sendTrigger())
      .with(['peak', P.number], ([, value]) => this.context.setParam('peak', value))
      .with(['attack', P.number], ([, value]) => this.context.setParam('attack', value))
      .with(['decay', P.number], ([, value]) => this.context.setParam('decay', value))
      .with(['sustain', P.number], ([, value]) => this.context.setParam('sustain', value))
      .with(['release', P.number], ([, value]) => this.context.setParam('release', value));
  }

  private sendTrigger(): void {
    const peak = this.context.getParam('peak') as number;
    const attack = this.context.getParam('attack') as number;
    const decay = this.context.getParam('decay') as number;
    const sustain = this.context.getParam('sustain') as number;

    this.context.send({
      type: 'trigger',
      values: { start: 0, peak, sustain },
      attack: { time: attack / 1000 },
      decay: { time: decay / 1000 }
    });
  }

  private sendRelease(): void {
    const release = this.context.getParam('release') as number;

    this.context.send({
      type: 'release',
      release: { time: release / 1000 },
      endValue: 0
    });
  }
}
