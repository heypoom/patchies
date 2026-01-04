import type { MessageContext } from '$lib/messages/MessageContext';
import type { ObjectInlet, ObjectOutlet } from '../object-metadata';
import type { TextObjectV2 } from '../interfaces/text-objects';

/**
 * LoadbangObject sends a bang message when the object is created/loaded.
 */
export class LoadbangObject implements TextObjectV2 {
	static type = 'loadbang';
	static description = 'Sends a bang signal when the object is created';
	static tags = ['control'];

	static inlets: ObjectInlet[] = [];

	static outlets: ObjectOutlet[] = [
		{
			name: 'out',
			type: 'bang',
			description: 'Bang signal sent on load'
		}
	];

	readonly nodeId: string;
	params: unknown[] = [];

	private messageContext: MessageContext;

	constructor(nodeId: string, messageContext: MessageContext) {
		this.nodeId = nodeId;
		this.messageContext = messageContext;
	}

	create(): void {
		// Send bang after a short delay to ensure connections are established
		setTimeout(() => {
			this.messageContext.send({ type: 'bang' });
		}, 500);
	}
}

