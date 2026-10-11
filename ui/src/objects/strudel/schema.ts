import {
  editorAppearanceMessages,
  editorAppearanceMessageSchemas
} from '$lib/editor-appearance/editor-appearance';
import { Type } from '@sinclair/typebox';
import type { ObjectSchema } from '$lib/objects/schemas/types';
import { schema } from '$lib/objects/schemas/types';
import { sym } from '$lib/objects/schemas/helpers';
import { Bang, Collapse, Expand, Run, messages, SetCode } from '$lib/objects/schemas/common';

// Strudel-specific message schemas
const Mute = sym('mute');
const Unmute = sym('unmute');

/** Pre-wrapped matchers for use with ts-pattern */
export const strudelMessages = {
  ...messages,
  ...editorAppearanceMessages,
  string: schema(Type.String()),
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
        { schema: Expand, description: 'Open the expanded editor' },
        { schema: Collapse, description: 'Close the expanded editor' },
        { schema: Type.String(), description: 'Set the code in the editor' },
        { schema: SetCode, description: 'Set the code in the editor' },
        ...editorAppearanceMessageSchemas,
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
