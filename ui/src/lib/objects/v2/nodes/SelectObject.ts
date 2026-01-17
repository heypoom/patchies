import type { ObjectContext } from '../ObjectContext';
import type { ObjectInlet, ObjectOutlet } from '../object-metadata';
import type { TextObjectV2, MessageMeta } from '../interfaces/text-objects';
import { match } from 'ts-pattern';

/**
 * SelectObject tests input against a list of values and outputs bangs on match.
 * Similar to Pure Data's [select] or [sel] object.
 *
 * - Inlet 0: Input to compare against arguments
 * - Inlet 1 (only with single argument): Update the match value
 * - Outlets 0..n-1: Bang when input matches corresponding argument
 * - Rightmost outlet: Pass through when no match
 *
 * Example: [select 1 2 3] has 4 outlets - bang for 1, bang for 2, bang for 3, and pass-through
 */
export class SelectObject implements TextObjectV2 {
	static type = 'select';
	static aliases = ['sel'];
	static description = 'Test input against values, output bang on match or pass through';

	static inlets: ObjectInlet[] = [
		{ name: 'input', type: 'message', description: 'Value to test against arguments' },
		{ name: 'set', type: 'message', description: 'Set match value (single argument mode)' }
	];

	static outlets: ObjectOutlet[] = [
		{ name: '0', type: 'bang', description: 'Bang on match' },
		{ name: 'nomatch', type: 'message', description: 'Pass through on no match' }
	];

	readonly nodeId: string;
	readonly context: ObjectContext;

	private matchValues: (number | string)[] = [0];

	constructor(nodeId: string, context: ObjectContext) {
		this.nodeId = nodeId;
		this.context = context;
	}

	create(params: unknown[]): void {
		if (params.length > 0) {
			this.matchValues = params.map((p) => {
				const num = Number(p);
				return isNaN(num) ? String(p) : num;
			});
		}
	}

	onMessage(data: unknown, meta: MessageMeta): void {
		match(meta.inletName)
			.with('input', () => {
				const input = typeof data === 'number' ? data : String(data);
				let matched = false;

				for (let i = 0; i < this.matchValues.length; i++) {
					if (input === this.matchValues[i]) {
						this.context.send({ type: 'bang' }, { to: i });
						matched = true;
						break;
					}
				}

				if (!matched) {
					// Send to rightmost outlet (nomatch)
					this.context.send(data, { to: this.matchValues.length });
				}
			})
			.with('set', () => {
				// Only works in single-argument mode
				if (this.matchValues.length === 1) {
					const num = Number(data);
					this.matchValues[0] = isNaN(num) ? String(data) : num;
				}
			});
	}

	/**
	 * Get dynamic outlets based on match values.
	 */
	getOutlets(): ObjectOutlet[] {
		const outlets: ObjectOutlet[] = this.matchValues.map((val, i) => ({
			name: String(i),
			type: 'bang' as const,
			description: `Bang when input equals ${val}`
		}));

		// Add nomatch outlet
		outlets.push({
			name: 'nomatch',
			type: 'message' as const,
			description: 'Pass through when no match'
		});

		return outlets;
	}

	/**
	 * Get dynamic inlets - only show 'set' inlet in single-argument mode.
	 */
	getInlets(): ObjectInlet[] {
		const inlets: ObjectInlet[] = [
			{ name: 'input', type: 'message', description: 'Value to test against arguments' }
		];

		if (this.matchValues.length === 1) {
			inlets.push({
				name: 'set',
				type: 'message',
				description: `Set match value (currently ${this.matchValues[0]})`
			});
		}

		return inlets;
	}
}
