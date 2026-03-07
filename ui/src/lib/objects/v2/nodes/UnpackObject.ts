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
    { name: '0', type: 'message', description: 'Element 0' },
    { name: '1', type: 'message', description: 'Element 1' }
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
  }

  getOutlets(): ObjectOutlet[] {
    return Array.from({ length: this.count }, (_, i) => ({
      name: String(i),
      type: 'message' as const,
      description: `Element ${i}`
    }));
  }
}
