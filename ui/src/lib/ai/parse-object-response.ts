import { extractJson } from './extract-json';

export class AiResponseError extends Error {
  constructor(
    message: string,
    readonly responseText: string
  ) {
    super(message);
    this.name = 'AiResponseError';
  }
}

// Models sometimes emit literal newlines in code strings. Escaping only control
// characters preserves the code while leaving other malformed JSON invalid.
function escapeStringControlCharacters(json: string): string {
  let inString = false;
  let escaped = false;

  let result = '';

  for (const char of json) {
    if (inString && !escaped && char.charCodeAt(0) < 32) {
      result += `\\u${char.charCodeAt(0).toString(16).padStart(4, '0')}`;
      escaped = false;

      continue;
    }

    if (char === '"' && !escaped) {
      inString = !inString;
    }

    escaped = inString && char === '\\' && !escaped;
    result += char;
  }

  return result;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- resolver schemas validate the parsed result
export function parseObjectResponse(responseText: string): any {
  const json = extractJson(responseText.trim());

  try {
    try {
      return JSON.parse(json);
    } catch {
      return JSON.parse(escapeStringControlCharacters(json));
    }
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);

    throw new AiResponseError(`AI response could not be read as JSON: ${reason}`, responseText);
  }
}
