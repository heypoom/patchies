import { expect, test, vi } from 'vitest';

const { generateText } = vi.hoisted(() => ({ generateText: vi.fn() }));

vi.mock('./providers', () => ({ getTextProvider: () => ({ generateText }) }));
vi.mock('./object-prompts/build-generator-instructions', () => ({
  buildObjectTypeInstructions: () => '',
  buildMultiObjectInstructionParts: () => ({ objectInstructions: '' })
}));

vi.mock('./generate-handle-docs', () => ({ generateHandleDocs: () => '' }));

import { resolveMultipleObjectsFromPrompt } from './multi-object-resolver';
import { editObjectFromPrompt } from './edit-object-resolver';
import { generateObjectConfigForType } from './single-object-resolver';

for (const operation of ['edit', 'single'] as const) {
  const generate = () =>
    operation === 'edit'
      ? editObjectFromPrompt('Draw stars', 'js')
      : generateObjectConfigForType({ generateText } as never, 'Draw stars', 'js');

  test(`${operation} preserves literal newlines and tabs in generated code`, async () => {
    generateText.mockResolvedValueOnce(
      '{"type":"js","data":{"code":"const x = 1;\n\tconsole.log(x);"}}'
    );

    await expect(generate()).resolves.toEqual({
      type: 'js',
      data: { code: 'const x = 1;\n\tconsole.log(x);' }
    });
  });

  test(`${operation} retains the model response when it returns text`, async () => {
    const response = 'Please tell me which colors you want.';
    generateText.mockResolvedValueOnce(response);

    await expect(generate()).rejects.toMatchObject({ responseText: response });
  });

  test(`${operation} retains valid JSON that is missing required object fields`, async () => {
    const responseText = '{"message":"Please clarify your request"}';
    generateText.mockResolvedValueOnce(responseText);

    await expect(generate()).rejects.toMatchObject({ responseText });
  });
}

for (const stage of ['router', 'generator'] as const) {
  test(`multi retains prose responses from the ${stage}`, async () => {
    const responseText = 'Please clarify the connections.';

    if (stage === 'generator') {
      generateText.mockResolvedValueOnce('{"objectTypes":["js"],"structure":"a single object"}');
    }

    generateText.mockResolvedValueOnce(responseText);

    await expect(resolveMultipleObjectsFromPrompt('Draw stars')).rejects.toMatchObject({
      responseText
    });
  });
}
