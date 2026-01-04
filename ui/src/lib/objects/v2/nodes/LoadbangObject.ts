import type { ObjectContext } from '../ObjectContext';
import type { ObjectInlet, ObjectOutlet } from '../object-metadata';
import type { TextObjectV2 } from '../interfaces/text-objects';

/**
 * LoadbangObject sends a bang message when the object is created/loaded.
 */
export class LoadbangObject implements TextObjectV2 {
	static type = 'loadbang';
	static description = 'Sends a bang signal when the object is created';

	static inlets: ObjectInlet[] = [];

	static outlets: ObjectOutlet[] = [
		{
			name: 'out',
			type: 'bang',
			description: 'Bang signal sent on load'
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
