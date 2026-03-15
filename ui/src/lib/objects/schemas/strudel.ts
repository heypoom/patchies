import { Type } from '@sinclair/typebox';
import type { ObjectSchema } from './types';
import { schema } from './types';
import { msg, sym } from './helpers';
import { Bang, Run, messages, SetCode } from './common';

// Strudel-specific message schemas
const SetFontSize = msg('setFontSize', { value: Type.Number() });
const SetFontFamily = msg('setFontFamily', { value: Type.String() });
const SetStyles = msg('setStyles', {
  value: Type.Object({ container: Type.Optional(Type.String()) })
});
const Mute = sym('mute');
const Unmute = sym('unmute');

/** Pre-wrapped matchers for use with ts-pattern */
export const strudelMessages = {
  ...messages,
  string: schema(Type.String()),
  setFontSize: schema(SetFontSize),
  setFontFamily: schema(SetFontFamily),
  setStyles: schema(SetStyles),
  mute: schema(Mute),
  unmute: schema(Unmute)
};

/**
 * Schema for the strudel (Strudel music environment) object.
 */
export const strudelSchema: ObjectSchema = {
  type: 'strudel',
  category: 'audio',
  description: 'Strudel live coding environment based on TidalCycles',
  inlets: [
    {
      id: 'message',
      description: 'Control messages',
      handle: { handleType: 'message' },
      messages: [
        { schema: Bang, description: 'Evaluate code and start playback' },
        { schema: Run, description: 'Evaluate code and start playback' },
        { schema: Type.String(), description: 'Set the code in the editor' },
        { schema: SetCode, description: 'Set the code in the editor' },
        { schema: SetFontSize, description: 'Set editor font size' },
        { schema: SetFontFamily, description: 'Set editor font family' },
        { schema: SetStyles, description: 'Set custom styles for editor container' },
        { schema: Mute, description: 'Silence audio output' },
        { schema: Unmute, description: 'Restore audio output after mute' }
      ]
    }
  ],
  outlets: [
    {
      id: 'audio',
      type: 'signal',
      description: 'Audio output',
      handle: { handleType: 'audio' }
    }
  ],
  tags: ['audio', 'livecoding', 'tidalcycles', 'pattern', 'music'],
  hasDynamicOutlets: true
};
