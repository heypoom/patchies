import type { ObjectContext } from '../ObjectContext';
import type { ObjectInlet, ObjectOutlet } from '../object-metadata';
import type { TextObjectV2, MessageMeta } from '../interfaces/text-objects';

/**
 * Get a nested property value using dot notation.
 * e.g., getByPath({ user: { name: 'foo' } }, 'user.name') => 'foo'
 */
function getByPath(obj: unknown, path: string): unknown {
	if (obj === null || obj === undefined) return undefined;
	if (!path) return obj;

	const parts = path.split('.');
	let current: unknown = obj;

	for (const part of parts) {
		if (current === null || current === undefined) return undefined;
		if (typeof current !== 'object') return undefined;
		current = (current as Record<string, unknown>)[part];
	}

	return current;
}

/**
 * UniqbyObject filters consecutive duplicate values by a specific key.
 * Like Unix `uniq` but compares by a property path instead of the whole value.
 *
 * Usage: `uniqby id` or `uniqby user.name`
 */
export class UniqbyObject implements TextObjectV2 {
	static type = 'uniqby';
	static description = 'Filters consecutive duplicates by a specific key';

	static inlets: ObjectInlet[] = [
		{ name: 'message', type: 'message', description: 'Message to filter' },
		{
			name: 'key',
			type: 'symbol',
			description: 'Property path to compare (e.g., "id" or "user.name")',
			defaultValue: ''
		}
	];

	static outlets: ObjectOutlet[] = [
		{ name: 'out', type: 'message', description: 'Unique messages' }
	];

	readonly nodeId: string;
	readonly context: ObjectContext;

	private lastKeyValue: unknown = undefined;
	private hasReceivedFirst = false;

	constructor(nodeId: string, context: ObjectContext) {
		this.nodeId = nodeId;
		this.context = context;
	}

	onMessage(value: unknown, meta: MessageMeta): void {
		if (meta.inletName === 'key') {
			if (typeof value === 'string') {
				this.context.setParam('key', value);
			}
			return;
		}

		if (meta.inletName === 'message') {
			const keyPath = this.context.getParam('key') as string;
			const currentKeyValue = getByPath(value, keyPath);

			// First value always passes through
			if (!this.hasReceivedFirst) {
				this.hasReceivedFirst = true;
				this.lastKeyValue = currentKeyValue;
				this.context.send(value);
				return;
			}

			// Compare key values - only send if different
			if (this.lastKeyValue !== currentKeyValue) {
				this.lastKeyValue = currentKeyValue;
				this.context.send(value);
			}
		}
	}

	/**
	 * Handle bang message to reset state
	 */
	onBang(): void {
		this.lastKeyValue = undefined;
		this.hasReceivedFirst = false;
	}
}
