import { Output } from 'webmidi';

import type { ObjectContext } from '../ObjectContext';
import type { ObjectInlet, ObjectOutlet } from '../object-metadata';
import type { TextObjectV2, MessageMeta } from '../interfaces/text-objects';
import { match } from 'ts-pattern';

type MidiEventData =
	| { type: 'noteOn'; note: number; velocity?: number; channel?: number }
	| { type: 'noteOff'; note: number; velocity?: number; channel?: number }
	| { type: 'controlChange'; control: number; value: number; channel?: number }
	| { type: 'programChange'; program: number; channel?: number }
	| { type: 'pitchBend'; value: number; channel?: number };

/**
 * WebMidiLinkObject converts MIDI events to WebMidiLink format.
 * Receives MIDI events and outputs messages as hex strings per the WebMidiLink spec.
 * @see https://www.g200kg.com/en/docs/webmidilink/spec.html
 */
export class WebMidiLinkObject implements TextObjectV2 {
	static type = 'webmidilink';
	static description = 'Converts MIDI events to WebMidiLink format';

	static inlets: ObjectInlet[] = [
		{
			name: 'midi',
			type: 'message',
			description: 'MIDI event (noteOn, noteOff, controlChange, programChange, pitchBend)'
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

		match(event)
			.with({ type: 'noteOn' }, (e) => {
				this.output.channels[channel].sendNoteOn(e.note, { rawAttack: e.velocity ?? 127 });
			})
			.with({ type: 'noteOff' }, (e) => {
				this.output.channels[channel].sendNoteOff(e.note, { rawRelease: e.velocity ?? 0 });
			})
			.with({ type: 'controlChange' }, (e) => {
				this.output.channels[channel].sendControlChange(e.control, e.value);
			})
			.with({ type: 'programChange' }, (e) => {
				this.output.channels[channel].sendProgramChange(e.program);
			})
			.with({ type: 'pitchBend' }, (e) => {
				this.output.channels[channel].sendPitchBend(e.value);
			})
			.exhaustive();
	}
}
