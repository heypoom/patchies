/**
 * Import and register all text object classes here.
 */

import { AdsrObject } from './AdsrObject';
import { DebounceObject } from './DebounceObject';
import { DelayObject } from './DelayObject';
import { FloatObject } from './FloatObject';
import { IntObject } from './IntObject';
import { KVObject } from './KVObject';
import { LoadbangObject } from './LoadbangObject';
import { MetroObject } from './MetroObject';
import { MtofObject } from './MtofObject';
import { SelectObject } from './SelectObject';
import { SpigotObject } from './SpigotObject';
import { ThrottleObject } from './ThrottleObject';
import { UniqbyObject } from './UniqbyObject';
import { WebMidiLinkObject } from './WebMidiLinkObject';
import { SendObject } from './SendObject';
import { RecvObject } from './RecvObject';

import { ObjectRegistry } from '$lib/registry/ObjectRegistry';

import type { TextObjectClass } from '../interfaces/text-objects';

export const TEXT_OBJECTS = [
  AdsrObject,
  DebounceObject,
  DelayObject,
  FloatObject,
  IntObject,
  KVObject,
  LoadbangObject,
  MetroObject,
  MtofObject,
  SelectObject,
  SpigotObject,
  ThrottleObject,
  UniqbyObject,
  WebMidiLinkObject,
  SendObject,
  RecvObject
] as const satisfies TextObjectClass[];

/**
 * Register all V2 text objects with the ObjectRegistry.
 * This should be called during application initialization.
 */
export function registerTextObjects(): void {
  const registry = ObjectRegistry.getInstance();

  TEXT_OBJECTS.forEach((object) => registry.register(object));
}
