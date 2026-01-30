/**
 * Orca I/O Coordinator
 *
 * Original implementation from Orca by Hundred Rabbits
 * Repository: https://github.com/hundredrabbits/Orca
 * License: MIT
 * Copyright (c) Hundred Rabbits
 *
 * Adapted for Patchies with TypeScript and MessageContext integration
 */

import type { MessageContext } from '$lib/messages/MessageContext';
import { MidiMessageHandler } from './MidiMessageHandler';
import { CCMessageHandler } from './CCMessageHandler';
import { MonoMessageHandler } from './MonoMessageHandler';

export class IO {
  private messageContext: MessageContext;

  midi: MidiMessageHandler;
  cc: CCMessageHandler;
  mono: MonoMessageHandler;

  constructor(messageContext: MessageContext) {
    this.messageContext = messageContext;
    this.midi = new MidiMessageHandler(messageContext);
    this.cc = new CCMessageHandler(messageContext);
    this.mono = new MonoMessageHandler(messageContext);
  }

  start(): void {
    this.clear();
  }

  clear(): void {
    this.midi.clear();
    this.cc.clear();
    this.mono.clear();
  }

  run(): void {
    this.midi.run();
    this.cc.run();
    this.mono.run();
  }

  silence(): void {
    this.midi.silence();
    this.mono.silence();
  }

  reset(): void {
    this.clear();
  }
}
