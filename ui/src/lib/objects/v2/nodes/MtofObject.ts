import type { ObjectContext } from '../ObjectContext';
import type { ObjectInlet, ObjectOutlet } from '../object-metadata';
import type { TextObjectV2, MessageMeta } from '../interfaces/text-objects';

/**
 * MtofObject converts MIDI note numbers to frequency values.
 * Formula: frequency = 440 * 2^((note - 69) / 12)
 */
export class MtofObject implements TextObjectV2 {
	static type = 'mtof';
	static description = 'Converts MIDI note values to frequency float values';

	static inlets: ObjectInlet[] = [
		{ name: 'note', type: 'float', description: 'MIDI note value (0-127)' }
	];

	static outlets: ObjectOutlet[] = [
		{ name: 'frequency', type: 'float', description: 'Frequency in Hz' }
	];

	readonly nodeId: string;
	readonly context: ObjectContext;

	constructor(nodeId: string, context: ObjectContext) {
		this.nodeId = nodeId;
		this.context = context;
	}

	onMessage(data: unknown, meta: MessageMeta): void {
		if (meta.inlet === 0 && typeof data === 'number') {
			const frequency = 440 * Math.pow(2, (data - 69) / 12);
			this.context.send(frequency);
		}
	}
}
