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
		// Match original Orca's order: check length first, then isPlayed
		for (const channelStr in this.stack) {
			const channel = parseInt(channelStr);

			// Check length and release if needed
			if (this.stack[channel] && this.stack[channel].length < 1) {
				this.release(this.stack[channel]);
			}

			// Check if item still exists after potential release
			if (!this.stack[channel]) continue;

			// Press if not yet played
			if (this.stack[channel].isPlayed === false) {
				this.press(this.stack[channel]);
			}

			// Decrement length
			this.stack[channel].length--;
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
		// Matches original Orca implementation
		const transposed = transposeTable[note];
		if (!transposed) return 60; // Default to middle C

		const octaveOffset = parseInt(transposed.charAt(1));
		const noteName = transposed.charAt(0);

		// Note values match original Orca's array order
		const noteValues = ['C', 'c', 'D', 'd', 'E', 'F', 'f', 'G', 'g', 'A', 'a', 'B'];
		const noteValue = noteValues.indexOf(noteName);
		if (noteValue === -1) return 60;

		const finalOctave = clamp(octave + octaveOffset, 0, 8);
		// Add 24 to match original Orca (shifts range up 2 octaves)
		return clamp(finalOctave * 12 + noteValue + 24, 0, 127);
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
