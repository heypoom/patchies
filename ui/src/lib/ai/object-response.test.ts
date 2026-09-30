import { expect, test, vi } from 'vitest';

const { generateText } = vi.hoisted(() => ({ generateText: vi.fn() }));

vi.mock('./providers', () => ({ getTextProvider: () => ({ generateText }) }));
vi.mock('./object-prompts/build-generator-instructions', () => ({
  buildObjectTypeInstructions: () => '',
  buildMultiObjectInstructionParts: () => ({ objectInstructions: '' })
}));

vi.mock('./generate-handle-docs', () => ({ generateHandleDocs: () => '' }));

import { runModeResolver } from './modes/run-resolver';
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

test('AI edit applies the leading object and preserves the trailing explanation', async () => {
  const data = {
    code: 'const label = "a } brace and a \\"quote\\"";\nconst settings = { value: 1 };'
  };
  const explanation =
    'The knob is a gray brushed-metal dial.\n\n**Controls**\n- Drag to change the value.';
  generateText.mockResolvedValueOnce(
    `${JSON.stringify({ type: 'three.dom', data })}\n\n${explanation}`
  );

  await expect(editObjectFromPrompt('3D gray circular knob', 'three.dom')).resolves.toEqual({
    type: 'three.dom',
    data,
    explanation
  });
});

for (const mode of ['edit', 'insert'] as const) {
  test(`${mode} carries the explanation through the mode resolver`, async () => {
    if (mode === 'insert') generateText.mockResolvedValueOnce('three.dom');

    generateText.mockResolvedValueOnce(
      '{"type":"three.dom","data":{"code":"drawKnob();"}}\n\nDrag to change the value.'
    );

    const result = await runModeResolver(
      mode,
      'Gray circular knob',
      { selectedNode: { id: 'knob', type: 'three.dom', data: {}, position: { x: 0, y: 0 } } },
      new AbortController().signal,
      () => {}
    );

    expect(result).toMatchObject({
      kind: mode === 'edit' ? 'edit' : 'single',
      data: { code: 'drawKnob();' },
      explanation: 'Drag to change the value.'
    });
  });
}

test('multi combines explanations from routing and generation', async () => {
  generateText.mockResolvedValueOnce(
    '{"objectTypes":["js"],"structure":"a single object"}\n\nOne object is enough.'
  );
  generateText.mockResolvedValueOnce(
    '{"nodes":[{"type":"js","data":{}}],"edges":[]}\n\nSend a bang to start.'
  );

  await expect(resolveMultipleObjectsFromPrompt('Draw stars')).resolves.toMatchObject({
    nodes: [{ type: 'js', data: {} }],
    explanation: 'One object is enough.\n\nSend a bang to start.'
  });
});
