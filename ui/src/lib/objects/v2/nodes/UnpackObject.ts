import type { ObjectContext } from '../ObjectContext';
import type { ObjectInlet, ObjectOutlet } from '../object-metadata';
import type { TextObjectV2 } from '../interfaces/text-objects';

/**
 * UnpackObject splits an array into individual elements, one per outlet.
 * Similar to Pure Data's [unpack] object.
 *
 * Example: [unpack 3] has 3 outlets — outputs array[0], array[1], array[2]
 *
 * - Creation param: number of elements to unpack (default: 2)
 * - Inlet 0: Array to unpack
 * - Outlets 0..n-1: Individual elements
 */
export class UnpackObject implements TextObjectV2 {
  static type = 'unpack';
  static description = 'Unpack array elements into separate outlets';

  static inlets: ObjectInlet[] = [
    { name: 'input', type: 'message', description: 'Array to unpack' }
  ];

  static outlets: ObjectOutlet[] = [
    { name: 'n', type: 'message', description: 'Nth element' },
    { name: 'remaining', type: 'message', description: 'Remaining elements beyond count' }
  ];

  readonly nodeId: string;
  readonly context: ObjectContext;

  private count: number = 2;

  constructor(nodeId: string, context: ObjectContext) {
    this.nodeId = nodeId;
    this.context = context;
  }

  create(params: unknown[]): void {
    if (params.length > 0) {
      const n = Number(params[0]);

      if (!isNaN(n) && n > 0) {
        this.count = Math.floor(n);
      }
    }
  }

  onMessage(data: unknown): void {
    const list = Array.isArray(data) ? data : [data];

    for (let i = 0; i < this.count; i++) {
      this.context.send(list[i] ?? null, { to: i });
    }

    // Send remaining elements as a slice to the last outlet
    if (list.length > this.count) {
      this.context.send(list.slice(this.count), { to: this.count });
    }
  }

  getOutlets(): ObjectOutlet[] {
    const outlets: ObjectOutlet[] = Array.from({ length: this.count }, (_, i) => ({
      name: String(i),
      type: 'message' as const,
      description: `Element ${i}`
    }));

    outlets.push({
      name: 'remaining',
      type: 'message' as const,
      description: 'Remaining elements beyond count'
    });

    return outlets;
  }
}
