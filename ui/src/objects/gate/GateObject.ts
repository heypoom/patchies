import type { ObjectContext } from '$lib/objects/v2/ObjectContext';
import type { MessageMeta, TextObjectV2 } from '$lib/objects/v2/interfaces/text-objects';
import type { ObjectInlet, ObjectOutlet } from '$lib/objects/v2/object-metadata';

const DEFAULT_ROUTE_COUNT = 2;

const getRouteCount = (params: unknown[]) => {
  const count = Number(params[0]);

  return Number.isInteger(count) && count > 0 ? count : DEFAULT_ROUTE_COUNT;
};

/** Routes one data inlet to the selected outlet. Mirrors Max's [gate] object. */
export class GateObject implements TextObjectV2 {
  static type = 'gate';
  static description = 'Route input to one selected output';
  static tags = ['control', 'routing', 'gate', 'switch'];

  static inlets: ObjectInlet[] = [
    {
      name: 'select',
      type: 'int',
      description: 'One-based output selector; 0 closes routing',
      hot: false
    },
    {
      name: 'input',
      type: 'any',
      description: 'Data to route to the selected output',
      hot: true
    }
  ];

  static outlets: ObjectOutlet[] = [
    { name: '1', type: 'any', description: 'First routed output' },
    { name: '2', type: 'any', description: 'Second routed output' }
  ];

  private routeCount = DEFAULT_ROUTE_COUNT;
  private selectedRoute = 0;

  constructor(
    readonly nodeId: string,
    readonly context: ObjectContext
  ) {}

  create(params: unknown[]): void {
    this.routeCount = getRouteCount(params);
  }

  onMessage(data: unknown, meta: MessageMeta): void {
    if (meta.inlet === 0) {
      if (typeof data === 'number' && Number.isInteger(data)) {
        this.selectedRoute = data;
      }

      return;
    }

    if (meta.inlet === 1 && this.selectedRoute >= 1 && this.selectedRoute <= this.routeCount) {
      this.context.send(data, { to: this.selectedRoute - 1 });
    }
  }

  getOutlets(): ObjectOutlet[] {
    return Array.from({ length: this.routeCount }, (_, index) => ({
      name: String(index + 1),
      type: 'any' as const,
      description: `Routed output ${index + 1}`
    }));
  }
}
