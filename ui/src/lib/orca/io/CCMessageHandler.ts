/**
 * Control Change (CC) Message Handler
 *
 * Original implementation from Orca by Hundred Rabbits
 * Repository: https://github.com/hundredrabbits/Orca
 * License: MIT
 * Copyright (c) Hundred Rabbits
 *
 * Adapted for Patchies with TypeScript and MessageContext integration
 */

import type { MessageContext } from '$lib/messages/MessageContext';

interface CCMessage {
	type: 'cc' | 'pb' | 'pg';
	channel: number;
	knob?: number;
	value?: number;
	lsb?: number;
	msb?: number;
	bank?: number;
	sub?: number;
	pgm?: number;
}

export class CCMessageHandler {
	private messageContext: MessageContext;
	stack: CCMessage[] = [];
	offset: number = 64;

	constructor(messageContext: MessageContext) {
		this.messageContext = messageContext;
	}

	run(): void {
		if (this.stack.length < 1) return;

		for (const msg of this.stack) {
			if (
				msg.type === 'cc' &&
				msg.channel !== undefined &&
				msg.knob !== undefined &&
				msg.value !== undefined
			) {
				this.messageContext.send({
					type: 'controlChange',
					channel: msg.channel,
					control: this.offset + msg.knob,
					value: msg.value
				});
			} else if (
				msg.type === 'pb' &&
				msg.channel !== undefined &&
				msg.lsb !== undefined &&
				msg.msb !== undefined
			) {
				this.messageContext.send({
					type: 'pitchBend',
					channel: msg.channel,
					lsb: msg.lsb,
					msb: msg.msb
				});
			} else if (msg.type === 'pg' && msg.channel !== undefined) {
				if (msg.bank !== undefined) {
					this.messageContext.send({
						type: 'controlChange',
						channel: msg.channel,
						control: 0,
						value: msg.bank
					});
				}
				if (msg.sub !== undefined) {
					this.messageContext.send({
						type: 'controlChange',
						channel: msg.channel,
						control: 32,
						value: msg.sub
					});
				}
				if (msg.pgm !== undefined) {
					this.messageContext.send({
						type: 'programChange',
						channel: msg.channel,
						program: msg.pgm
					});
				}
			}
		}
	}

	setOffset(offset: number): void {
		if (isNaN(offset)) return;
		this.offset = offset;
	}

	clear(): void {
		this.stack = [];
	}
}
