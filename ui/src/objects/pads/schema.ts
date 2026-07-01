import { Type } from '@sinclair/typebox';
import { msg } from '$lib/objects/schemas/helpers';
import { schema } from '$lib/objects/schemas/types';

/** Load a sample into a specific pad slot: { type: 'load', pad: 0, src: 'user://Samples/kick.wav' } */
export const LoadPad = msg('load', { pad: Type.Number(), src: Type.String() });
export const TriggerPad = msg('bang', {
  index: Type.Number(),
  value: Type.Number(),
  time: Type.Optional(Type.Number())
});

export const padsMessages = {
  loadPad: schema(LoadPad),
  triggerPad: schema(TriggerPad)
};
