import type { ObjectContext } from '$lib/objects/v2/ObjectContext';
import type { TextObjectV2 } from '$lib/objects/v2/interfaces/text-objects';
import type { ObjectInlet, ObjectOutlet } from '$lib/objects/v2/object-metadata';

export class LabelObject implements TextObjectV2 {
  static type = 'label';
  static category = 'ui';
  static description = 'A simple text label for annotations and notes in your patch.';
  static tags = ['annotation', 'label', 'text', 'ui'];

  static inlets: ObjectInlet[] = [];
  static outlets: ObjectOutlet[] = [];

  constructor(
    readonly nodeId: string,
    readonly context: ObjectContext
  ) {}
}
