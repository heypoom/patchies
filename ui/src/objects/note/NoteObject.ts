import type { ObjectContext } from '$lib/objects/v2/ObjectContext';
import type { TextObjectV2 } from '$lib/objects/v2/interfaces/text-objects';
import type { ObjectInlet, ObjectOutlet } from '$lib/objects/v2/object-metadata';

export class NoteObject implements TextObjectV2 {
  static type = 'note';
  static category = 'ui';
  static description = 'A resizable post-it note for annotations and comments.';
  static tags = ['annotation', 'comment', 'documentation', 'ui'];

  static inlets: ObjectInlet[] = [];
  static outlets: ObjectOutlet[] = [];

  constructor(
    readonly nodeId: string,
    readonly context: ObjectContext
  ) {}
}
