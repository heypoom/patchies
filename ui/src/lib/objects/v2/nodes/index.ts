/**
 * Import and register all text object classes here.
 */

import { AdsrObject } from '$objects/adsr/AdsrObject';
import { BeatObject } from '$objects/beat/BeatObject';
import { ButtonObject } from '$objects/button/ButtonObject';
import {
  AndObject,
  EqualObject,
  GreaterThanObject,
  GreaterThanOrEqualObject,
  LessThanObject,
  LessThanOrEqualObject,
  NotEqualObject,
  NotObject,
  OrObject
} from '$objects/boolean-operators/BooleanOperatorObject';
import { ClipObject } from '$objects/clip/ClipObject';
import { DebounceObject } from '$objects/debounce/DebounceObject';
import { DelayObject } from '$objects/delay/DelayObject';
import { FloatObject } from '$objects/float/FloatObject';
import { IntObject } from '$objects/int/IntObject';
import { KVObject } from '$objects/kv/KVObject';
import { KnobObject } from '$objects/knob/KnobObject';
import { LabelObject } from '$objects/label/LabelObject';
import { LinkObject } from '$objects/link/LinkObject';
import { LoadbangObject } from '$objects/loadbang/LoadbangObject';
import { MetroObject } from '$objects/metro/MetroObject';
import { MtofObject } from '$objects/mtof/MtofObject';
import { NoteObject } from '$objects/note/NoteObject';
import {
  AddObject,
  DivideObject,
  MultiplyObject,
  SubtractObject
} from '$objects/numeric-operators/NumericOperatorObject';
import { PackObject } from '$objects/pack/PackObject';
import { PatchbayObject } from '$objects/patchbay/PatchbayObject';
import { SelectObject } from '$objects/select/SelectObject';
import { ScaleObject } from '$objects/scale/ScaleObject';
import { SliderObject } from '$objects/slider/SliderObject';
import { SpigotObject } from '$objects/spigot/SpigotObject';
import { ThrottleObject } from '$objects/throttle/ThrottleObject';
import { TitleObject } from '$objects/title/TitleObject';
import { ToggleObject } from '$objects/toggle/ToggleObject';
import { UniqbyObject } from '$objects/uniqby/UniqbyObject';
import { WebMidiLinkObject } from '$objects/web-midi-link/WebMidiLinkObject';
import { SendObject } from '$objects/send-recv/SendObject';
import { RecvObject } from '$objects/send-recv/RecvObject';
import { SamplerateObject } from '$objects/samplerate/SamplerateObject';
import { UnpackObject } from '$objects/unpack/UnpackObject';
import { StackObject } from '$objects/stack/StackObject';
import { QueueObject } from '$objects/queue/QueueObject';
import { SwitchObject } from '$objects/switch/SwitchObject';
import { TextboxObject } from '$objects/textbox/TextboxObject';

import { ObjectRegistry } from '$lib/registry/ObjectRegistry';

import type { TextObjectClass } from '$lib/objects/v2/interfaces/text-objects';

export const TEXT_OBJECTS = [
  AdsrObject,
  ClipObject,
  BeatObject,
  DebounceObject,
  DelayObject,
  FloatObject,
  IntObject,
  KVObject,
  MetroObject,
  MtofObject,
  AddObject,
  SubtractObject,
  MultiplyObject,
  DivideObject,
  AndObject,
  OrObject,
  NotObject,
  EqualObject,
  NotEqualObject,
  LessThanObject,
  LessThanOrEqualObject,
  GreaterThanObject,
  GreaterThanOrEqualObject,
  PackObject,
  PatchbayObject,
  SelectObject,
  ScaleObject,
  SpigotObject,
  ThrottleObject,
  UniqbyObject,
  WebMidiLinkObject,
  SendObject,
  RecvObject,
  SamplerateObject,
  UnpackObject,
  StackObject,
  QueueObject,
  LoadbangObject
] as const satisfies TextObjectClass[];

export const VISUAL_OBJECTS = [
  ButtonObject,
  KnobObject,
  LabelObject,
  LinkObject,
  NoteObject,
  SliderObject,
  TitleObject,
  ToggleObject,
  SwitchObject,
  TextboxObject
] as const satisfies TextObjectClass[];

export const RUNTIME_OBJECTS = [
  ...TEXT_OBJECTS,
  ...VISUAL_OBJECTS
] as const satisfies TextObjectClass[];

/**
 * Register all runtime objects with the ObjectRegistry.
 * This should be called during application initialization.
 */
export function registerTextObjects(): void {
  const registry = ObjectRegistry.getInstance();

  RUNTIME_OBJECTS.forEach((object) => registry.register(object));
}
