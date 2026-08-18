import { describe, expect, test } from 'vitest';

import {
  CONTEXT_TOOL_NAMES,
  GET_VIEWPORT,
  LIST_VFS_FILES,
  READ_VFS_TEXT,
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

  test('declares bounded VFS inspection tools as context tools', () => {
    const list = contextToolDeclarations.find((tool) => tool.name === LIST_VFS_FILES);
    const read = contextToolDeclarations.find((tool) => tool.name === READ_VFS_TEXT);

    expect(CONTEXT_TOOL_NAMES.has(LIST_VFS_FILES)).toBe(true);
    expect(CONTEXT_TOOL_NAMES.has(READ_VFS_TEXT)).toBe(true);
    expect(list?.parametersJsonSchema).toMatchObject({ type: 'object' });
    expect(read?.parametersJsonSchema).toMatchObject({
      properties: { path: { type: 'string' }, length: { type: 'number' } },
      required: ['path']
    });
  });
});
