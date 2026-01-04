import type { MessageContext } from '$lib/messages/MessageContext';

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
		{ name: 'out', type: 'bang', description: 'Bang signal sent on load' }
	];

	params: unknown[] = [];
	readonly nodeId: string;
	private messageContext: MessageContext;

	constructor(nodeId: string, messageContext: MessageContext) {
		this.nodeId = nodeId;
		this.messageContext = messageContext;
	}

	create(): void {
		// Send bang after a short delay to ensure connections are established
		// TODO: use a proper "ready" event rather than bang
		setTimeout(() => {
			this.messageContext.send({ type: 'bang' });
		}, 500);
	}
}
