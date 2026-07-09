import type { ObjectContext } from '$lib/objects/v2/ObjectContext';
import type { ObjectInlet, ObjectOutlet } from '$lib/objects/v2/object-metadata';
import type { TextObjectV2 } from '$lib/objects/v2/interfaces/text-objects';
import { Bang } from '$lib/objects/schemas/common';

/**
 * LoadbangObject sends a bang message when the object is created/loaded.
 */
export class LoadbangObject implements TextObjectV2 {
  static type = 'loadbang';
  static category = 'control';
  static description = 'Send bang message when patch loads';
  static tags = ['control', 'initialization', 'startup', 'trigger'];

  static inlets: ObjectInlet[] = [];

  static outlets: ObjectOutlet[] = [
    {
      name: 'message',
      type: 'bang',
      description: 'Bang on load',
      messages: [{ schema: Bang, description: 'Sent when patch loads' }],
      handle: { handleType: 'message' }
    }
  ];

  readonly nodeId: string;
  readonly context: ObjectContext;

  constructor(nodeId: string, context: ObjectContext) {
    this.nodeId = nodeId;
    this.context = context;
  }

  create(): void {
    // Send bang after a short delay to ensure connections are established
    setTimeout(() => {
      this.context.send({ type: 'bang' });
    }, 500);
  }
}
