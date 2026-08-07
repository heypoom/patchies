import { Type } from '@sinclair/typebox';
import Json5 from 'json5';
import { match } from 'ts-pattern';

import {
  Bang,
  COMMON_SCHEMAS,
  Set,
  buildCommonMessageTypeMap,
  buildMessageTypeMap,
  buildMessageTypeMapForTypes,
  objectSchemas,
  messages
} from '$lib/objects/schemas';
import { schema } from '$lib/objects/schemas/types';
import type { ObjectContext } from '$lib/objects/v2/ObjectContext';
import type { MessageMeta, TextObjectV2 } from '$lib/objects/v2/interfaces/text-objects';
import type { ObjectInlet, ObjectOutlet } from '$lib/objects/v2/object-metadata';
import {
  splitByTopLevelSpaces,
  splitSequentialMessages,
  tryResolveShorthand
} from '$lib/messages/message-parser';
import { parseInletCount } from '$lib/utils/expr-parser';

const globalMessageTypeMap = buildMessageTypeMap(objectSchemas);
const commonMessageTypeMap = buildCommonMessageTypeMap(COMMON_SCHEMAS);

const SetMessage = schema(Set);

export type MsgData = {
  message?: string;
};

export class MsgObject implements TextObjectV2 {
  static type = 'msg';
  static category = 'interface';
  static description = 'Store and send predefined messages';
  static tags = ['interface', 'message', 'trigger', 'data'];
  static handlePatterns = {
    inlet: {
      template: 'message-in-{index}',
      handleType: 'message' as const,
      description:
        'Indexed inlets: message-in-0 (hot, triggers output), message-in-1+ (cold, set $N placeholders)'
    }
  };
  static inlets: ObjectInlet[] = [
    {
      name: 'message',
      type: 'message',
      description: 'Control messages and the hot $1 placeholder value',
      hot: true,
      handle: { handleType: 'message', handleId: 0 },
      messages: [
        { schema: Bang, description: 'Output the stored message' },
        { schema: Set, description: 'Set message without triggering output' },
        {
          schema: Type.Any(),
          description: 'Store as $1 and trigger output when the message uses placeholders'
        }
      ]
    }
  ];
  static outlets: ObjectOutlet[] = [
    {
      name: 'message',
      type: 'message',
      description: 'Message output',
      handle: { handleType: 'message' },
      messages: [
        { schema: Type.Any(), description: 'The stored message with placeholders replaced' }
      ]
    }
  ];

  private inletValues: unknown[] = [];

  constructor(
    readonly nodeId: string,
    readonly context: ObjectContext
  ) {}

  onMessage(data: unknown, meta: MessageMeta): void {
    const inlet = meta.inlet ?? 0;

    if (inlet > 0) {
      this.storeInletValue(inlet, data);
      return;
    }

    match(data)
      .with(null, () => this.output())
      .with(undefined, () => this.output())
      .with(messages.bang, () => this.output())
      .with(SetMessage, ({ value }) => this.setMessage(value))
      .otherwise((value) => {
        if (this.getPlaceholderCount() > 0) {
          this.storeInletValue(0, value);
        }

        this.output();
      });
  }

  getInlets(): ObjectInlet[] {
    const placeholderCount = this.getPlaceholderCount();
    const inletCount = Math.max(1, placeholderCount);

    return Array.from({ length: inletCount }, (_, index) => ({
      ...MsgObject.inlets[0],
      name: placeholderCount > 0 ? `$${index + 1}` : 'bang',
      description:
        placeholderCount === 0
          ? 'Output the stored message'
          : index === 0
            ? 'Set $1 and output the stored message'
            : `Set $${index + 1} without output`,
      hot: index === 0,
      handle: { handleType: 'message', handleId: index }
    }));
  }

  private output(): void {
    const { message = '' } = this.getData();
    const messageTypeMap = this.getMessageTypeMap();

    for (const segment of splitSequentialMessages(message)) {
      const resolved = this.resolveSegmentWithPlaceholders(
        segment,
        this.inletValues,
        messageTypeMap
      );

      if (resolved.resolved) {
        this.context.send(resolved.value);
      }
    }
  }

  private resolveSegmentWithPlaceholders(
    segment: string,
    inletValues: unknown[],
    messageTypeMap: typeof globalMessageTypeMap
  ): { resolved: true; value: unknown } | { resolved: false } {
    let processedMessage = segment;

    for (let index = 0; index < 9; index++) {
      const value = inletValues[index];
      if (value === undefined) continue;

      const replacement = serializePlaceholderValue(value);
      if (replacement === undefined) return { resolved: false };

      processedMessage = processedMessage.replaceAll(`$${index + 1}`, replacement);
    }

    if (/\$[1-9]/.test(processedMessage)) return { resolved: false };

    return { resolved: true, value: resolveMessageSegment(processedMessage, messageTypeMap) };
  }

  private setMessage(value: unknown): void {
    let message: string;

    if (typeof value === 'string') {
      message = value;
    } else {
      try {
        message = Json5.stringify(value, null, 2);
      } catch {
        message = String(value);
      }
    }

    this.context.setData({ message }, { notifyUI: true });
  }

  private storeInletValue(inlet: number, value: unknown): void {
    this.inletValues[inlet] = value;
  }

  private getPlaceholderCount(): number {
    return parseInletCount(this.getData().message ?? '');
  }

  private getMessageTypeMap(): typeof globalMessageTypeMap {
    const targetTypes = this.context.getConnectedTargetTypes();

    return targetTypes.length === 0
      ? globalMessageTypeMap
      : buildMessageTypeMapForTypes(objectSchemas, targetTypes, commonMessageTypeMap);
  }

  private getData(): MsgData {
    const data = this.context.getData<MsgData>();

    return {
      message: typeof data.message === 'string' ? data.message : ''
    };
  }
}

function serializePlaceholderValue(value: unknown): string | undefined {
  try {
    return JSON.stringify(value);
  } catch {
    return undefined;
  }
}

function parseToken(token: string): unknown {
  try {
    return Json5.parse(token);
  } catch {
    return { type: token };
  }
}

function resolveMessageSegment(
  message: string,
  messageTypeMap: typeof globalMessageTypeMap
): unknown {
  try {
    return Json5.parse(message);
  } catch {
    // Continue with Patchies' space-separated message syntax.
  }

  const tokens = splitByTopLevelSpaces(message);

  if (tokens.length > 1) {
    const resolved = tryResolveShorthand(tokens, messageTypeMap);

    return resolved ?? tokens.map(parseToken);
  }

  return { type: message };
}
