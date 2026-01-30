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
      // Match original Orca's !isNaN() checks
      if (
        msg.type === 'cc' &&
        !isNaN(msg.channel as number) &&
        !isNaN(msg.knob as number) &&
        !isNaN(msg.value as number)
      ) {
        this.messageContext.send({
          type: 'controlChange',
          channel: msg.channel as number,
          control: this.offset + (msg.knob as number),
          value: msg.value as number
        });
      } else if (
        msg.type === 'pb' &&
        !isNaN(msg.channel as number) &&
        !isNaN(msg.lsb as number) &&
        !isNaN(msg.msb as number)
      ) {
        this.messageContext.send({
          type: 'pitchBend',
          channel: msg.channel as number,
          lsb: msg.lsb as number,
          msb: msg.msb as number
        });
      } else if (msg.type === 'pg' && !isNaN(msg.channel as number)) {
        if (!isNaN(msg.bank as number)) {
          this.messageContext.send({
            type: 'controlChange',
            channel: msg.channel as number,
            control: 0,
            value: msg.bank as number
          });
        }
        if (!isNaN(msg.sub as number)) {
          this.messageContext.send({
            type: 'controlChange',
            channel: msg.channel as number,
            control: 32,
            value: msg.sub as number
          });
        }
        if (!isNaN(msg.pgm as number)) {
          this.messageContext.send({
            type: 'programChange',
            channel: msg.channel as number,
            program: msg.pgm as number
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
