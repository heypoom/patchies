import { Type } from '@sinclair/typebox';
import { match } from 'ts-pattern';

import type { ObjectContext } from '$lib/objects/v2/ObjectContext';
import type { MessageMeta, TextObjectV2 } from '$lib/objects/v2/interfaces/text-objects';
import type { ObjectInlet, ObjectOutlet } from '$lib/objects/v2/object-metadata';
import { Bang, Clear, messages } from '$lib/objects/schemas/common';
import { schema } from '$lib/objects/schemas/types';

const TextControl = Type.String();

const textboxMessages = {
  textControl: schema(TextControl)
};

export class TextboxObject implements TextObjectV2 {
  static type = 'textbox';
  static category = 'interface';
  static description = 'Multi-line text input field';
  static tags = ['interface', 'text', 'input', 'multiline'];

  static inlets: ObjectInlet[] = [
    {
      name: 'message',
      type: 'string',
      description: 'Control messages',
      defaultValue: '',
      messages: [
        { schema: Bang, description: 'Output the current text' },
        { schema: TextControl, description: 'Set the text content' },
        { schema: Clear, description: 'Clear the text content' }
      ],
      handle: { handleType: 'message' }
    }
  ];

  static outlets: ObjectOutlet[] = [
    {
      name: 'message',
      type: 'string',
      description: 'Text output',
      messages: [{ schema: Type.String(), description: 'Current text content' }],
      handle: { handleType: 'message' }
    }
  ];

  constructor(
    readonly nodeId: string,
    readonly context: ObjectContext
  ) {}

  onMessage(data: unknown, meta: MessageMeta): void {
    const inletName = meta.inletName ?? 'message';

    match([inletName, data])
      .with(['message', textboxMessages.textControl], ([, text]) => {
        this.setText(text);
      })
      .with(['message', messages.bang], () => {
        this.context.send(this.getText());
      })
      .with(['message', messages.clear], () => {
        this.setText('');
      })
      .otherwise(() => {});
  }

  private getText(): string {
    const text = this.context.getData<{ text?: unknown }>().text;

    return typeof text === 'string' ? text : '';
  }

  private setText(text: string): void {
    this.context.setData({ text }, { notifyUI: true });
  }
}
