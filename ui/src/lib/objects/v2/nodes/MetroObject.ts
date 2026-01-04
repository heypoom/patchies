import type { ObjectContext } from '../ObjectContext';
import type { ObjectInlet, ObjectOutlet } from '../object-metadata';
import type { TextObjectV2, MessageMeta } from '../interfaces/text-objects';
import { match, P } from 'ts-pattern';

/**
 * MetroObject sends bang messages at regular intervals.
 */
export class MetroObject implements TextObjectV2 {
	static type = 'metro';
	static description = 'Metronome that sends bang signals at regular intervals';
	static tags = ['control'];

	static inlets: ObjectInlet[] = [
		{
			name: 'message',
			type: 'message',
			description: 'Control messages: "start", "stop", or bang to toggle'
		},
		{
			name: 'interval',
			type: 'int',
			description: 'Interval in milliseconds',
			defaultValue: 1000,
			minNumber: 0
		}
	];

	static outlets: ObjectOutlet[] = [
		{ name: 'out', type: 'bang', description: 'Bang signal sent at regular intervals' }
	];

	readonly nodeId: string;
	readonly context: ObjectContext;

	private intervalId: number | null = null;

	constructor(nodeId: string, context: ObjectContext) {
		this.nodeId = nodeId;
		this.context = context;
	}

	create(): void {
		// Auto-start metro on load
		this.start();
	}

	onMessage(data: unknown, meta: MessageMeta): void {
		match([meta.inlet, data])
			.with([0, { type: 'start' }], () => this.start())
			.with([0, { type: 'stop' }], () => this.stop())
			.with([0, { type: 'bang' }], () => {
				if (this.intervalId !== null) {
					this.stop();
				} else {
					this.start();
				}
			})
			.with([1, P.number], ([, ms]) => {
				this.context.setParam('interval', ms);
				if (this.intervalId !== null) {
					this.start(); // Restart with new interval
				}
			});
	}

	private start(): void {
		this.stop();

		const intervalMs = this.context.getParam('interval') as number;

		this.intervalId = window.setInterval(() => {
			this.context.send({ type: 'bang' });
		}, intervalMs);
	}

	private stop(): void {
		if (this.intervalId !== null) {
			clearInterval(this.intervalId);
			this.intervalId = null;
		}
	}

	destroy(): void {
		this.stop();
	}
}
