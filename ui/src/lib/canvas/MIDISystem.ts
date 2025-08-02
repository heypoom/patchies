import {
	WebMidi,
	type Input,
	type Output,
	type NoteMessageEvent,
	type ControlChangeMessageEvent,
	type MessageEvent
} from 'webmidi';
import { MessageSystem } from '$lib/messages/MessageSystem';
import { match } from 'ts-pattern';
import {
	updateMIDIInputDevices,
	updateMIDIOutputDevices,
	midiInitialized
} from '../../stores/midi.store';

export interface MIDIInputConfig {
	deviceId?: string;
	channel?: number;
	messageTypes?: ('noteOn' | 'noteOff' | 'controlChange' | 'programChange')[];
}

export type MIDIOutputConfig = {
	deviceId?: string;
	channel?: number;
} & (
	| { messageType: 'noteOn'; data: { note: number; velocity: number } }
	| { messageType: 'noteOff'; data: { note: number; velocity: number } }
	| { messageType: 'controlChange'; data: { control: number; value: number } }
	| { messageType: 'programChange'; data: { program: number } }
);

interface NodeListeners {
	noteOn?: (e: NoteMessageEvent) => void;
	noteOff?: (e: NoteMessageEvent) => void;
	controlChange?: (e: ControlChangeMessageEvent) => void;
	programChange?: (e: MessageEvent) => void;
	input?: Input;
	channel?: number | 'all';
}

export class MIDISystem {
	private static instance: MIDISystem;
	private messageSystem = MessageSystem.getInstance();
	private inputListeners = new Map<string, NodeListeners>();

	public isInitialized = false;
	public webmidi = WebMidi;

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
		// Listen for MIDI device connection/disconnection events
		WebMidi.addListener('connected', () => {
			console.log('MIDI device connected');
			this.updateDeviceLists();
		});

		WebMidi.addListener('disconnected', () => {
			console.log('MIDI device disconnected!');
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
			messageTypes = ['noteOn', 'noteOff', 'controlChange', 'programChange']
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

		console.log(`[midi-${nodeId}] listening:`, input, config);

		const channelToUse = channel || 'all';
		const listeners: NodeListeners = {
			input,
			channel: channelToUse
		};

		if (messageTypes.includes('noteOn')) {
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

		if (messageTypes.includes('noteOff')) {
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

		if (messageTypes.includes('controlChange')) {
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

		if (messageTypes.includes('programChange')) {
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

			this.inputListeners.delete(nodeId);
		}
	}

	sendMessage(config: MIDIOutputConfig) {
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
				.with({ messageType: 'noteOn' }, ({ data }) => {
					if (data.note !== undefined && data.velocity !== undefined) {
						output.playNote(data.note, { attack: data.velocity, channels: channel });
					}
				})
				.with({ messageType: 'noteOff' }, ({ data }) => {
					if (data.note !== undefined) {
						output.stopNote(data.note, { channels: channel });
					}
				})
				.with({ messageType: 'controlChange' }, ({ data }) => {
					if (data.control !== undefined && data.value !== undefined) {
						output.sendControlChange(data.control, data.value, { channels: channel });
					}
				})
				.with({ messageType: 'programChange' }, ({ data }) => {
					if (data.program !== undefined) {
						output.sendProgramChange(data.program, { channels: channel });
					}
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
}

// @ts-expect-error -- expose MIDISystem globally for debugging
window.MIDISystem = MIDISystem.getInstance();
