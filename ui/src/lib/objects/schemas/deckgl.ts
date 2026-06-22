import type { ObjectSchema } from './types';
import { Run, SetCode } from './common';

/**
 * Schema for the deckgl data visualization object.
 */
export const deckglSchema: ObjectSchema = {
  type: 'deckgl',
  category: 'video',
  description: 'Renders deck.gl data visualization layers into the video pipeline',
  inlets: [
    {
      id: 'message',
      description: 'Control messages',
      messages: [
        { schema: SetCode, description: 'Set the code in the editor' },
        { schema: Run, description: 'Evaluate code and update visuals' }
      ]
    }
  ],
  outlets: [],
  tags: ['deckgl', 'data', 'visualization', 'map', 'geospatial', 'webgl'],
  hasDynamicOutlets: true,
  handlePatterns: {
    inlet: {
      template: 'video-in-{index}',
      handleType: 'video',
      description: 'Video inlets (0-indexed), message inlets use message-in-{index}'
    },
    outlet: {
      template: 'video-out-{index}',
      handleType: 'video',
      description: 'Video outlets (0-indexed), message outlets use message-out-{index}'
    }
  }
};
