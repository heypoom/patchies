import { Type } from '@sinclair/typebox';
import type { ObjectSchema } from './types';
import { schema } from './types';
import { msg, sym } from './helpers';
import { Bang, messages } from './common';

// Strudel-specific message schemas
const Run = sym('run');
const SetCode = msg('setCode', { code: Type.String() });
const SetFontSize = msg('setFontSize', { value: Type.Number() });
const SetFontFamily = msg('setFontFamily', { value: Type.String() });
const SetStyles = msg('setStyles', {
  value: Type.Object({ container: Type.Optional(Type.String()) })
});

/** Pre-wrapped matchers for use with ts-pattern */
export const strudelMessages = {
  ...messages,
  run: schema(Run),
  setCode: schema(SetCode),
  setFontSize: schema(SetFontSize),
  setFontFamily: schema(SetFontFamily),
  setStyles: schema(SetStyles)
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
      messages: [
        { schema: Bang, description: 'Evaluate code and start playback' },
        { schema: Run, description: 'Evaluate code and start playback' },
        { schema: Type.String(), description: 'Set the code in the editor' },
        { schema: SetCode, description: 'Set the code in the editor' },
        { schema: SetFontSize, description: 'Set editor font size' },
        { schema: SetFontFamily, description: 'Set editor font family' },
        { schema: SetStyles, description: 'Set custom styles for editor container' }
      ]
    }
  ],
  outlets: [],
  tags: ['audio', 'livecoding', 'tidalcycles', 'pattern', 'music'],
  hasDynamicOutlets: true
};
