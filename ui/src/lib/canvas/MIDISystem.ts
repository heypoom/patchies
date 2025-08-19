import {
	WebMidi,
	type Input,
	type Output,
	type NoteMessageEvent,
	type ControlChangeMessageEvent,
	type MessageEvent,
	type PitchBendMessageEvent
} from 'webmidi';
import { MessageSystem } from '$lib/messages/MessageSystem';
import { match } from 'ts-pattern';
import {
	updateMIDIInputDevices,
	updateMIDIOutputDevices,
	midiInitialized
} from '../../stores/midi.store';
import { Launchpad } from '$lib/midi/launchpad';

export interface MIDIInputConfig {
	deviceId?: string;
	channel?: number;
	events?: ('noteOn' | 'noteOff' | 'controlChange' | 'programChange' | 'pitchBend')[];
}

export type MIDIOutputConfig = {
	deviceId?: string;
	channel?: number;
} & (
	| { event: 'noteOn'; note: number; velocity: number }
	| { event: 'noteOff'; note: number; velocity: number }
	| { event: 'controlChange'; control: number; value: number }
	| { event: 'programChange'; program: number }
	| { event: 'pitchBend'; value: number }
	| { event: 'raw'; data: number[] }
);

interface NodeListeners {
	noteOn?: (e: NoteMessageEvent) => void;
	noteOff?: (e: NoteMessageEvent) => void;
	controlChange?: (e: ControlChangeMessageEvent) => void;
	programChange?: (e: MessageEvent) => void;
	pitchBend?: (e: PitchBendMessageEvent) => void;
	input?: Input;
	channel?: number | 'all';
}

export class MIDISystem {
	private static instance: MIDISystem;
	private messageSystem = MessageSystem.getInstance();
	private inputListeners = new Map<string, NodeListeners>();

	public isInitialized = false;
	public webmidi = WebMidi;
	public lpx = Launchpad.getInstance();

	get inputs(): Input[] {
		return WebMidi.inputs;
	}

	get outputs(): Output[] {
		return WebMidi.outputs;
	}

	static getInstance() {
		if (!MIDISystem.instance) {
			MIDISystem.instance = new MIDISystem();
		}
		return MIDISystem.instance;
	}

	constructor() {
		// Initialize stores with empty arrays
		updateMIDIInputDevices([]);
		updateMIDIOutputDevices([]);
	}

	async initialize() {
		if (WebMidi.enabled) return;

		try {
			await WebMidi.enable({ sysex: true });

			this.updateDeviceLists();
			this.setupDeviceListeners();

			midiInitialized.set(true);
			console.log('[midi] ready');
		} catch (error) {
			console.error('Failed to initialize MIDI:', error);
			throw error;
		}
	}

	private updateDeviceLists() {
		updateMIDIInputDevices(this.inputs);
		updateMIDIOutputDevices(this.outputs);
	}

	private setupDeviceListeners() {
		WebMidi.addListener('connected', () => {
			this.updateDeviceLists();
		});

		WebMidi.addListener('disconnected', () => {
			this.updateDeviceLists();
		});
	}

	getInputs() {
		this.updateDeviceLists();
		return this.inputs;
	}

	getOutputs() {
		this.updateDeviceLists();
		return this.outputs;
	}

	getInputById(deviceId: string): Input | undefined {
		return this.inputs.find((input) => input.id === deviceId);
	}

	getOutputById(deviceId: string): Output | undefined {
		return this.outputs.find((output) => output.id === deviceId);
	}

	startListening(nodeId: string, config: MIDIInputConfig) {
		this.stopListening(nodeId);

		const {
			deviceId,
			channel,
			events = ['noteOn', 'noteOff', 'controlChange', 'programChange', 'pitchBend']
		} = config;

		if (!deviceId) {
			console.warn('No MIDI device ID specified for input node:', nodeId);
			return;
		}

		const input = this.getInputById(deviceId);
		if (!input) {
			console.warn('MIDI input device not found:', deviceId);
			return;
		}

		const channelToUse = channel || 'all';
		const listeners: NodeListeners = {
			input,
			channel: channelToUse
		};

		if (events.includes('noteOn')) {
			listeners.noteOn = (e: NoteMessageEvent) => {
				this.messageSystem.sendMessage(nodeId, {
					type: 'noteOn',
					note: e.note.number,
					velocity: e.note.rawAttack || 0
				});
			};

			input.addListener('noteon', listeners.noteOn, {
				channels: channelToUse === 'all' ? undefined : channelToUse
			});
		}

		if (events.includes('noteOff')) {
			listeners.noteOff = (e: NoteMessageEvent) => {
				this.messageSystem.sendMessage(nodeId, {
					type: 'noteOff',
					note: e.note.number,
					velocity: e.note.rawRelease || 0
				});
			};

			input.addListener('noteoff', listeners.noteOff, {
				channels: channelToUse === 'all' ? undefined : channelToUse
			});
		}

		if (events.includes('controlChange')) {
			listeners.controlChange = (e: ControlChangeMessageEvent) => {
				this.messageSystem.sendMessage(nodeId, {
					type: 'controlChange',
					control: e.controller.number,
					value: typeof e.value === 'number' ? e.value : 0
				});
			};

			input.addListener('controlchange', listeners.controlChange, {
				channels: channelToUse === 'all' ? undefined : channelToUse
			});
		}

		if (events.includes('programChange')) {
			listeners.programChange = (e: MessageEvent) => {
				this.messageSystem.sendMessage(nodeId, {
					type: 'programChange',
					program: typeof e.value === 'number' ? e.value : 0
				});
			};

			input.addListener('programchange', listeners.programChange, {
				channels: channelToUse === 'all' ? undefined : channelToUse
			});
		}

		if (events.includes('pitchBend')) {
			listeners.pitchBend = (e: PitchBendMessageEvent) => {
				this.messageSystem.sendMessage(nodeId, {
					type: 'pitchBend',
					value: e.value
				});
			};

			input.addListener('pitchbend', listeners.pitchBend, {
				channels: channelToUse === 'all' ? undefined : channelToUse
			});
		}

		this.inputListeners.set(nodeId, listeners);
	}

	stopListening(nodeId: string) {
		const listeners = this.inputListeners.get(nodeId);
		if (listeners && listeners.input) {
			if (listeners.noteOn) {
				listeners.input.removeListener('noteon', listeners.noteOn);
			}

			if (listeners.noteOff) {
				listeners.input.removeListener('noteoff', listeners.noteOff);
			}

			if (listeners.controlChange) {
				listeners.input.removeListener('controlchange', listeners.controlChange);
			}

			if (listeners.programChange) {
				listeners.input.removeListener('programchange', listeners.programChange);
			}

			if (listeners.pitchBend) {
				listeners.input.removeListener('pitchbend', listeners.pitchBend);
			}

			this.inputListeners.delete(nodeId);
		}
	}

	sendMidiMessage(config: MIDIOutputConfig) {
		const { deviceId, channel = 1 } = config;

		if (!deviceId) {
			console.warn('No MIDI device ID specified for output');
			return;
		}

		const output = this.getOutputById(deviceId);
		if (!output) {
			console.warn('MIDI output device not found:', deviceId);
			return;
		}

		try {
			match(config)
				.with({ event: 'noteOn' }, ({ note, velocity }) => {
					if (note !== undefined) {
						output.playNote(note, { rawAttack: velocity, channels: channel });
					}
				})
				.with({ event: 'noteOff' }, ({ note, velocity }) => {
					if (note !== undefined) {
						output.stopNote(note, { rawRelease: velocity, channels: channel });
					}
				})
				.with({ event: 'controlChange' }, ({ control, value }) => {
					if (control !== undefined && value !== undefined) {
						output.sendControlChange(control, value, { channels: channel });
					}
				})
				.with({ event: 'programChange' }, ({ program }) => {
					if (program !== undefined) {
						output.sendProgramChange(program, { channels: channel });
					}
				})
				.with({ event: 'pitchBend' }, ({ value }) => {
					if (value !== undefined) {
						output.sendPitchBend(value, { channels: channel });
					}
				})
				.with({ event: 'raw' }, ({ data }) => {
					output.send(data);
				})
				.otherwise((unknownType) => {
					console.warn('Unknown MIDI message type:', unknownType);
				});
		} catch (error) {
			console.error('Failed to send MIDI message:', error);
		}
	}

	cleanup() {
		for (const nodeId of this.inputListeners.keys()) {
			this.stopListening(nodeId);
		}
		this.inputListeners.clear();
	}

	setupLaunchpad() {
		this.lpx.setup(this.outputs);
	}
}

// @ts-expect-error -- expose MIDISystem globally for debugging
window.MIDISystem = MIDISystem.getInstance();
