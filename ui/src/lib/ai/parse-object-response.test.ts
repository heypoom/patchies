import { expect, test } from 'vitest';
import { parseObjectResponse } from './parse-object-response';

test('preserves JSON escapes, quotes, and backslashes when recovering control characters', () => {
  const code = 'const path = "C:\\tmp";\n\tconsole.log("hello");\r\n';

  const json = JSON.stringify({ type: 'js', data: { code } })
    .replace(/\\n/g, '\n')
    .replace(/(?<!\\)\\t/g, '\t');

  expect(parseObjectResponse(json)).toEqual({ type: 'js', data: { code } });
});

test('accepts valid fenced JSON without altering code', () => {
  const data = { type: 'js', data: { code: 'console.log("\\n");' } };

  expect(parseObjectResponse(`\`\`\`json\n${JSON.stringify(data)}\n\`\`\``)).toEqual(data);
});

test('retains truncated JSON instead of guessing missing code', () => {
  const responseText = '{"type":"js","data":{"code":"console.log(';

  expect(() => parseObjectResponse(responseText)).toThrow(
    expect.objectContaining({ responseText })
  );
});
