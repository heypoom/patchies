/**
 * Monophonic MIDI Message Handler
 *
 * Original implementation from Orca by Hundred Rabbits
 * Repository: https://github.com/hundredrabbits/Orca
 * License: MIT
 * Copyright (c) Hundred Rabbits
 *
 * Adapted for Patchies with TypeScript and MessageContext integration
 */

import { transposeTable } from '../transpose';
import type { MessageContext } from '$lib/messages/MessageContext';

interface MidiNote {
	channel: number;
	octave: number;
	note: string;
	velocity: number;
	length: number;
	isPlayed: boolean;
}

export class MonoMessageHandler {
	private messageContext: MessageContext;
	private stack: Record<number, MidiNote> = {};

	constructor(messageContext: MessageContext) {
		this.messageContext = messageContext;
	}

	push(channel: number, octave: number, note: string, velocity: number, length: number): void {
		if (this.stack[channel]) {
			this.release(this.stack[channel]);
		}
		this.stack[channel] = { channel, octave, note, velocity, length, isPlayed: false };
	}

	run(): void {
		for (const channelStr in this.stack) {
			const channel = parseInt(channelStr);
			const item = this.stack[channel];

			if (!item) continue;

			if (item.isPlayed === false) {
				this.press(item);
			}

			if (item.length < 1) {
				this.release(item);
			} else {
				item.length--;
			}
		}
	}

	private press(item: MidiNote): void {
		const midiNote = this.orcaNoteToMidi(item.note, item.octave);

		// Emit noteOn message
		this.messageContext.send({
			type: 'noteOn',
			note: midiNote,
			velocity: Math.floor((item.velocity / 16) * 127),
			channel: item.channel
		});

		item.isPlayed = true;
	}

	private release(item: MidiNote): void {
		const midiNote = this.orcaNoteToMidi(item.note, item.octave);

		// Emit noteOff message
		this.messageContext.send({
			type: 'noteOff',
			note: midiNote,
			channel: item.channel
		});

		delete this.stack[item.channel];
	}

	private orcaNoteToMidi(note: string, octave: number): number {
		// Convert Orca note format to MIDI number
		const transposed = transposeTable[note];
		if (!transposed) return 60; // Default to middle C

		const octaveOffset = parseInt(transposed.charAt(1));
		const noteName = transposed.charAt(0);
		const noteValues: Record<string, number> = {
			C: 0,
			c: 1,
			D: 2,
			d: 3,
			E: 4,
			F: 5,
			f: 6,
			G: 7,
			g: 8,
			A: 9,
			a: 10,
			B: 11
		};

		const noteValue = noteValues[noteName] ?? 0;
		const finalOctave = clamp(octave + octaveOffset, 0, 8);
		return (finalOctave + 1) * 12 + noteValue;
	}

	silence(): void {
		// Send noteOff for all active notes
		for (const channelStr in this.stack) {
			const item = this.stack[parseInt(channelStr)];
			if (item && item.isPlayed) {
				this.release(item);
			}
		}
	}

	clear(): void {
		this.stack = {};
	}

	length(): number {
		return Object.keys(this.stack).length;
	}
}

function clamp(v: number, min: number, max: number): number {
	return v < min ? min : v > max ? max : v;
}
