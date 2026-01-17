import type { ObjectContext } from '../ObjectContext';
import type { ObjectInlet, ObjectOutlet } from '../object-metadata';
import type { TextObjectV2, MessageMeta } from '../interfaces/text-objects';
import { match } from 'ts-pattern';

/**
 * DelayObject delays messages by a specified time.
 */
export class DelayObject implements TextObjectV2 {
	static type = 'delay';
	static description = 'Delays messages by a specified time';

	static inlets: ObjectInlet[] = [
		{ name: 'message', type: 'message', description: 'Message to pass through' },
		{ name: 'delay', type: 'int', description: 'How long to delay for in ms', defaultValue: 1000 }
	];

	static outlets: ObjectOutlet[] = [{ name: 'out', type: 'message' }];

	readonly nodeId: string;
	readonly context: ObjectContext;

	private pendingTimeouts: number[] = [];

	constructor(nodeId: string, context: ObjectContext) {
		this.nodeId = nodeId;
		this.context = context;
	}

	onMessage(value: unknown, meta: MessageMeta): void {
		match(meta.inletName)
			.with('message', () => {
				const delayMs = this.context.getParam('delay') as number;

				const timeoutId = window.setTimeout(() => {
					this.context.send(value);
					this.pendingTimeouts = this.pendingTimeouts.filter((id) => id !== timeoutId);
				}, delayMs);

				this.pendingTimeouts.push(timeoutId);
			})
			.with('delay', () => {
				if (typeof value === 'number') {
					this.context.setParam('delay', value);
				}
			});
	}

	destroy(): void {
		for (const id of this.pendingTimeouts) {
			clearTimeout(id);
		}

		this.pendingTimeouts = [];
	}
}
