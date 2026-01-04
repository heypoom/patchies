import type { ObjectContext } from '../ObjectContext';
import type { ObjectInlet, ObjectOutlet } from '../object-metadata';
import type { TextObjectV2, MessageMeta } from '../interfaces/text-objects';

/**
 * DelayObject delays messages by a specified time.
 */
export class DelayObject implements TextObjectV2 {
	static type = 'delay';
	static description = 'Delays messages by a specified time';
	static tags = ['helper'];

	static inlets: ObjectInlet[] = [
		{ name: 'message', type: 'message', description: 'Message to pass through' },
		{
			name: 'delay',
			type: 'float',
			description: 'How long to delay for, in ms.',
			precision: 0,
			defaultValue: 1000
		}
	];

	static outlets: ObjectOutlet[] = [
		{ name: 'out', type: 'message', description: 'Message outlet' }
	];

	readonly nodeId: string;
	readonly context: ObjectContext;

	private pendingTimeouts: number[] = [];

	constructor(nodeId: string, context: ObjectContext) {
		this.nodeId = nodeId;
		this.context = context;
	}

	onMessage(data: unknown, meta: MessageMeta): void {
		if (meta.inletName === 'message') {
			const delayMs = (this.context.getParam('delay') as number) ?? 1000;

			const timeoutId = window.setTimeout(() => {
				this.context.send(data);
				this.pendingTimeouts = this.pendingTimeouts.filter((id) => id !== timeoutId);
			}, delayMs);

			this.pendingTimeouts.push(timeoutId);
		} else if (meta.inletName === 'delay' && typeof data === 'number') {
			this.context.setParam('delay', data);
		}
	}

	destroy(): void {
		// Clear all pending timeouts
		for (const id of this.pendingTimeouts) {
			clearTimeout(id);
		}
		this.pendingTimeouts = [];
	}
}
