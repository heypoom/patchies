import { Type } from '@sinclair/typebox';
import type { ObjectSchema } from './types';
import { schema } from './types';
import { msg } from './helpers';
import { Bang, Play, Pause, Stop, messages } from './common';

// Soundfile-specific message schemas
const LoadUrl = msg('load', { url: Type.String() });
const LoadPath = msg('load', { path: Type.String() });
const Read = msg('read', {});

/** Pre-wrapped matchers for use with ts-pattern */
export const soundfileMessages = {
  ...messages,
  string: schema(Type.String()),
  loadUrl: schema(LoadUrl),
  loadPath: schema(LoadPath),
  read: schema(Read)
};

/**
 * Schema for the soundfile~ (audio file player) object.
 */
export const soundfileSchema: ObjectSchema = {
  type: 'soundfile~',
  category: 'audio',
  description: 'Load and play audio files with transport controls',
  inlets: [
    {
      id: 'message',
      description: 'Control messages',
      messages: [
        { schema: Type.String(), description: 'Load audio file or stream by URL' },
        { schema: Bang, description: 'Play from start of sample' },
        { schema: Play, description: 'Play from current position' },
        { schema: Pause, description: 'Pause the playback' },
        { schema: Stop, description: 'Stop playback and reset position' },
        { schema: Read, description: 'Read audio buffer and send to output (for convolver~)' },
        { schema: LoadUrl, description: 'Load audio file or stream by URL' }
      ]
    }
  ],
  outlets: [
    {
      id: 'audio',
      type: 'signal',
      description: 'Audio output'
    }
  ],
  tags: ['audio', 'file', 'player', 'sample', 'music'],
  hasDynamicOutlets: true
};
