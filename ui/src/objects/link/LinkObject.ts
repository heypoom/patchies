import type { ObjectContext } from '$lib/objects/v2/ObjectContext';
import type { TextObjectV2 } from '$lib/objects/v2/interfaces/text-objects';
import type { ObjectInlet, ObjectOutlet } from '$lib/objects/v2/object-metadata';

export class LinkObject implements TextObjectV2 {
  static type = 'link';
  static category = 'ui';
  static description = 'A clickable hyperlink button that opens a URL in a new tab.';
  static tags = ['button', 'hyperlink', 'link', 'ui', 'url'];

  static inlets: ObjectInlet[] = [];
  static outlets: ObjectOutlet[] = [];

  constructor(
    readonly nodeId: string,
    readonly context: ObjectContext
  ) {}
}
