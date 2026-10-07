import { expect, test, vi } from 'vitest';

import { prepareLLMTools } from './llm-tools';

test('treats formats as annotations while validating argument types and collecting errors', async () => {
  const run = vi.fn().mockReturnValue('Saved');

  const { handlers } = prepareLLMTools({
    save: {
      description: 'Save contact details',
      parameters: {
        email: { type: 'string', format: 'email' },
        website: { type: 'string', format: 'uri' }
      },
      run
    }
  });

  const handle = handlers.get('save')!;
  const args = { email: 'an annotation', website: 'another annotation' };

  await expect(handle({ id: 'call-1', name: 'save', args })).resolves.toBe('Saved');
  expect(run).toHaveBeenCalledWith(args);

  await expect(
    handle({ id: 'call-2', name: 'save', args: { email: 123, website: false } })
  ).rejects.toThrow(/email must be string.*website must be string/);

  expect(run).toHaveBeenCalledTimes(1);
});

test('still rejects unknown schema keywords', () => {
  expect(() =>
    prepareLLMTools({
      save: {
        description: 'Save contact details',
        parameters: { email: { type: 'string', format: 'email', typo: true } },
        run: () => null
      }
    })
  ).toThrow('unknown keyword: "typo"');
});
