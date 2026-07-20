import type { ObjectContext } from '$lib/objects/v2/ObjectContext';
import type { TextObjectV2 } from '$lib/objects/v2/interfaces/text-objects';
import type { ObjectInlet, ObjectOutlet } from '$lib/objects/v2/object-metadata';

export class TitleObject implements TextObjectV2 {
  static type = 'title';
  static category = 'ui';
  static description = 'A resizable title label with centered text for diagrams and presentations.';
  static tags = ['diagram', 'label', 'presentation', 'text', 'title', 'ui'];

  static inlets: ObjectInlet[] = [];
  static outlets: ObjectOutlet[] = [];

  constructor(
    readonly nodeId: string,
    readonly context: ObjectContext
  ) {}
}
