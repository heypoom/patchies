import { Type } from '@sinclair/typebox';
import type { ObjectSchema } from './types';
import { schema } from './types';
import { msg } from './helpers';
import { Bang, Pause, Play, messages } from './common';

// Video-specific message schemas
const Loop = msg('loop', {
  value: Type.Optional(Type.Boolean())
});

const LoadUrl = msg('load', {
  url: Type.String()
});

const LoadPath = msg('load', {
  path: Type.String()
});

/** Pre-wrapped matchers for use with ts-pattern */
export const videoMessages = {
  ...messages,
  loop: schema(Loop),
  loadUrl: schema(LoadUrl),
  loadPath: schema(LoadPath)
};

/**
 * Schema for the video (video display) object.
 */
export const videoSchema: ObjectSchema = {
  type: 'video',
  category: 'video',
  description: 'Load and display videos from URLs or files',
  inlets: [
    {
      id: 'message',
      description: 'Control messages',
      messages: [
        { schema: Bang, description: 'Restart video from beginning' },
        { schema: Play, description: 'Start/resume playback' },
        { schema: Pause, description: 'Pause playback' },
        { schema: Loop, description: 'Set loop mode (default: true)' },
        { schema: LoadUrl, description: 'Load video from URL' },
        { schema: LoadPath, description: 'Load video from file path' },
        { schema: Type.String(), description: 'Load video from path' }
      ]
    }
  ],
  outlets: [],
  tags: ['video', 'movie', 'texture', 'visual', 'audio'],
  hasDynamicOutlets: true
};
