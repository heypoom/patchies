import { Output } from 'webmidi';

import type { ObjectContext } from '../ObjectContext';
import type { ObjectInlet, ObjectOutlet } from '../object-metadata';
import type { TextObjectV2, MessageMeta } from '../interfaces/text-objects';
import { match } from 'ts-pattern';

type MidiEventData = {
	type: 'noteOn' | 'noteOff';
	note: number;
	velocity?: number;
	channel?: number;
};

/**
 * WebMidiLinkObject converts MIDI events to WebMidiLink format.
 * Receives noteOn/noteOff events and outputs midi messages as hex strings.
 */
export class WebMidiLinkObject implements TextObjectV2 {
	static type = 'webmidilink';
	static description = 'Converts MIDI events to WebMidiLink format';

	static inlets: ObjectInlet[] = [
		{
			name: 'midi',
			type: 'message',
			description: 'MIDI event (noteOn/noteOff with note, velocity, channel)'
		}
	];

	static outlets: ObjectOutlet[] = [
		{ name: 'out', type: 'message', description: 'WebMidiLink formatted message (midi,XX,XX,XX)' }
	];

	readonly nodeId: string;
	readonly context: ObjectContext;

	private output: Output;

	constructor(nodeId: string, context: ObjectContext) {
		this.nodeId = nodeId;
		this.context = context;

		const link = {
			send: (bytes: number[]) => {
				const hex = bytes.map((v) => v.toString(16).padStart(2, '0')).join(',');
				this.context.send('midi,' + hex);
			}
		};

		// @ts-expect-error -- we are using a fake output here
		this.output = new Output(link);
	}

	onMessage(data: unknown, meta: MessageMeta): void {
		if (meta.inletName !== 'midi') return;

		const event = data as MidiEventData;
		if (!event || typeof event !== 'object' || !('type' in event)) return;

		const channel = event.channel ?? 1;

		match(event.type)
			.with('noteOn', () => {
				this.output.channels[channel].sendNoteOn(event.note, { rawAttack: event.velocity ?? 127 });
			})
			.with('noteOff', () => {
				this.output.channels[channel].sendNoteOff(event.note, { rawRelease: event.velocity ?? 0 });
			})
			.exhaustive();
	}
}
