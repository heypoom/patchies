import { expect, test } from 'vitest';
import { parseObjectResponse } from './parse-object-response';

test('preserves JSON escapes, quotes, and backslashes when recovering control characters', () => {
  const code = 'const path = "C:\\tmp";\n\tconsole.log("hello");\r\n';

  const json = JSON.stringify({ type: 'js', data: { code } })
    .replace(/\\n/g, '\n')
    .replace(/(?<!\\)\\t/g, '\t');

  expect(parseObjectResponse(json).value).toEqual({ type: 'js', data: { code } });
});

test('accepts valid fenced JSON without altering code', () => {
  const data = { type: 'js', data: { code: 'console.log("\\n");' } };

  expect(parseObjectResponse(`\`\`\`json\n${JSON.stringify(data)}\n\`\`\``).value).toEqual(data);
});

test('retains truncated JSON instead of guessing missing code', () => {
  const responseText = '{"type":"js","data":{"code":"console.log(';

  expect(() => parseObjectResponse(responseText)).toThrow(
    expect.objectContaining({ responseText })
  );
});

for (const fenced of [false, true]) {
  test(`separates explanations from ${fenced ? 'fenced' : 'plain'} nested JSON`, () => {
    const value = {
      type: 'three.dom',
      data: { code: 'const text = "} { \\"quoted\\" ```";', settings: [{ min: 0, max: 1 }] }
    };
    const explanation = '**Controls**\n- Drag up or down.\n- Hold Shift for fine control.';
    const json = JSON.stringify(value);
    const response = fenced
      ? `\`\`\`json\n${json}\n\`\`\`\n\n${explanation}`
      : `${json}\n\n${explanation}`;

    expect(parseObjectResponse(response)).toEqual({ value, explanation });
  });
}

test('does not salvage a malformed leading object by parsing a later object', () => {
  const responseText = '{"data":[}\n\n{"type":"js","data":{}}';

  expect(() => parseObjectResponse(responseText)).toThrow(
    expect.objectContaining({ responseText })
  );
});
