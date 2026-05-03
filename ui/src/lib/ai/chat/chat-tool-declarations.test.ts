import { describe, expect, test } from 'vitest';

import {
  CONTEXT_TOOL_NAMES,
  GET_VIEWPORT,
  contextToolDeclarations
} from './chat-tool-declarations';

describe('chat tool declarations', () => {
  test('declares get_viewport as an empty-args context tool', () => {
    const declaration = contextToolDeclarations.find((tool) => tool.name === GET_VIEWPORT);

    expect(CONTEXT_TOOL_NAMES.has(GET_VIEWPORT)).toBe(true);

    expect(declaration).toMatchObject({
      name: GET_VIEWPORT,
      parametersJsonSchema: { type: 'object', properties: {} }
    });
  });
});
