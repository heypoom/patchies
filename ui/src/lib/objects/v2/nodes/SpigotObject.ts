import { Type } from '@sinclair/typebox';

import type { ObjectContext } from '../ObjectContext';
import type { ObjectInlet, ObjectOutlet } from '../object-metadata';
import type { TextObjectV2, MessageMeta } from '../interfaces/text-objects';
import { match, P } from 'ts-pattern';
import { Bang } from '$lib/objects/schemas/common';

/**
 * SpigotObject acts as a gate that allows or blocks messages.
 */
export class SpigotObject implements TextObjectV2 {
  static type = 'spigot';
  static description = 'Message gate that allows or blocks data based on condition';
  static tags = ['control', 'gate', 'switch', 'filter'];

  static inlets: ObjectInlet[] = [
    {
      name: 'data',
      type: 'message',
      description: 'Data input',
      messages: [{ schema: Type.Any(), description: 'Data to pass through when allowed' }]
    },
    {
      name: 'control',
      type: 'message',
      description: 'Gate control',
      defaultValue: false,
      messages: [
        { schema: Type.Boolean(), description: 'Truthy allows data, falsey blocks data' },
        { schema: Bang, description: 'Bang toggles gate state' }
      ]
    }
  ];

  static outlets: ObjectOutlet[] = [
    { name: 'out', type: 'message', description: 'Output when spigot is open' }
  ];

  readonly nodeId: string;
  readonly context: ObjectContext;

  constructor(nodeId: string, context: ObjectContext) {
    this.nodeId = nodeId;
    this.context = context;
  }

  onMessage(data: unknown, meta: MessageMeta): void {
    const ctx = this.context;

    match([meta.inletName, data])
      .with(['data', P.any], ([, message]) => {
        const allowed = ctx.getParam('control') ?? false;

        if (allowed) ctx.send(message);
      })
      .with(['control', { type: 'bang' }], () => {
        const current = ctx.getParam('control') ?? false;

        ctx.setParam('control', !current);
      })
      .with(['control', P.boolean], ([, value]) => {
        ctx.setParam('control', value);
      })
      .with(['control', P.number], ([, value]) => {
        ctx.setParam('control', value > 0);
      })
      .with(['control', P.string], ([, value]) => {
        ctx.setParam('control', value.length > 0);
      })
      .with(['control', P.any], () => {
        ctx.setParam('control', false);
      });
  }
}
