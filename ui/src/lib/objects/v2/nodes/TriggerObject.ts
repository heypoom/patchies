import type { ObjectContext } from '../ObjectContext';
import type { ObjectInlet, ObjectOutlet } from '../object-metadata';
import type { TextObjectV2, MessageMeta } from '../interfaces/text-objects';
import {
  type MessageType,
  getMessageTypeName,
  getTypedOutput,
  parseMessageTypes
} from '$lib/messages/message-types';

/**
 * TriggerObject sends messages through multiple outlets in right-to-left order.
 * This enables Pd-style message sequencing where you need to set up
 * values before triggering an action.
 *
 * Usage: `trigger b b b` or `t f b s` creates outlets that fire right-to-left.
 *
 * Type specifiers:
 *   b -> bang: always sends { type: 'bang' }
 *   s -> symbol/string: passes symbols and strings (Max convention)
 *   t -> text: passes strings
 *   a -> any: passes input unchanged
 *   l -> list: passes arrays
 *   o -> object: passes plain objects (not arrays)
 *   n/f -> number/float: passes any number
 *
 * Example:
 *   [trigger f b] - on input 42, sends bang from outlet 1, then 42 from outlet 0
 */
export class TriggerObject implements TextObjectV2 {
  static type = 'trigger';
  static aliases = ['t'];
  static description =
    'Send messages through multiple outlets in right-to-left order (b=bang, s=symbol, a=any, l=list, o=object, n=number, i=int, f=float)';

  static inlets: ObjectInlet[] = [
    { name: 'input', type: 'message', description: 'Any message triggers output' }
  ];

  static outlets: ObjectOutlet[] = [
    { name: '0', type: 'message', description: 'Output 1' },
    { name: '1', type: 'message', description: 'Output 2' }
  ];

  readonly nodeId: string;
  readonly context: ObjectContext;

  private outletTypes: MessageType[] = ['bang', 'bang']; // Default: two bang outlets

  constructor(nodeId: string, context: ObjectContext) {
    this.nodeId = nodeId;
    this.context = context;
  }

  create(params: unknown[]): void {
    // Parse arguments: each valid type specifier adds an outlet
    // e.g., ['f', 'b', 's'] = 3 outlets with types float, bang, symbol
    const types = parseMessageTypes(params);

    if (types.length > 0) {
      this.outletTypes = types;
    }
  }

  onMessage(data: unknown, meta: MessageMeta): void {
    // Only respond to inlet 0
    if (meta.inlet !== undefined && meta.inlet !== 0) return;

    // Fire outputs right-to-left (highest outlet index first)
    for (let i = this.outletTypes.length - 1; i >= 0; i--) {
      const output = getTypedOutput(this.outletTypes[i], data);
      if (output !== undefined) {
        this.context.send(output, { to: i });
      }
    }
  }

  /**
   * Get dynamic outlets based on instance state.
   */
  getOutlets(): ObjectOutlet[] {
    return this.outletTypes.map((type, i) => ({
      name: String(i),
      type: 'message' as const,
      description: `${getMessageTypeName(type)} output`
    }));
  }
}
