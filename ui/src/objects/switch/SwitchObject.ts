import type { ObjectContext } from '$lib/objects/v2/ObjectContext';
import type { MessageMeta, TextObjectV2 } from '$lib/objects/v2/interfaces/text-objects';
import type { ObjectInlet, ObjectOutlet } from '$lib/objects/v2/object-metadata';

const DEFAULT_ROUTE_COUNT = 2;

const getRouteCount = (params: unknown[]) => {
  const count = Number(params[0]);

  return Number.isInteger(count) && count > 0 ? count : DEFAULT_ROUTE_COUNT;
};

/** Routes messages from the selected data inlet to one outlet. Mirrors Max's [switch] object. */
export class SwitchObject implements TextObjectV2 {
  static type = 'switch';
  static description = 'Route one selected input to an output';
  static tags = ['control', 'routing', 'switch', 'gate'];

  static inlets: ObjectInlet[] = [
    {
      name: '1',
      type: 'any',
      description: 'First data input',
      hot: true
    },
    {
      name: '2',
      type: 'any',
      description: 'Second data input',
      hot: true
    },
    {
      name: 'select',
      type: 'int',
      description: 'One-based input selector; 0 closes routing',
      hot: false
    }
  ];

  static outlets: ObjectOutlet[] = [
    { name: 'out', type: 'any', description: 'Messages from the selected input' }
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
    const inlet = meta.inlet ?? 0;

    if (inlet === this.routeCount) {
      if (typeof data === 'number' && Number.isInteger(data)) {
        this.selectedRoute = data;
      }

      return;
    }

    if (inlet === this.selectedRoute - 1) {
      this.context.send(data);
    }
  }

  getInlets(): ObjectInlet[] {
    const dataInlets = Array.from({ length: this.routeCount }, (_, index) => ({
      name: String(index + 1),
      type: 'any' as const,
      description: `Data input ${index + 1}`,
      hot: true
    }));

    return [
      ...dataInlets,
      {
        name: 'select',
        type: 'int',
        description: 'One-based input selector; 0 closes routing',
        hot: false
      }
    ];
  }
}
