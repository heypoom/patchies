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

/**
 * Strip content outside of the JSON object, i.e. at the end of the matching brace.
 * Extract explanations at the end of the JSON object.
 */
function splitObjectResponse(responseText: string): { json: string; explanation?: string } {
  const trimmed = responseText.trim();
  const openingFence = trimmed.match(/^```(?:json)?\s*/);
  const content = openingFence ? trimmed.slice(openingFence[0].length) : trimmed;

  if (!content.startsWith('{') && !content.startsWith('[')) {
    return { json: extractJson(trimmed) };
  }

  const containers: string[] = [];
  let inString = false;
  let escaped = false;

  for (let index = 0; index < content.length; index++) {
    const char = content[index];

    if (inString) {
      if (char === '"' && !escaped) {
        inString = false;
      }

      escaped = char === '\\' && !escaped;
      continue;
    }

    if (char === '"') {
      inString = true;
    } else if (char === '{' || char === '[') {
      containers.push(char);
    } else if (char === '}' || char === ']') {
      const expected = char === '}' ? '{' : '[';

      if (containers.pop() !== expected) {
        break;
      }

      if (containers.length === 0) {
        const suffix = content.slice(index + 1).trim();
        const explanation = openingFence ? suffix.replace(/^```\s*/, '').trim() : suffix;

        return { json: content.slice(0, index + 1), explanation: explanation || undefined };
      }
    }
  }

  return { json: content };
}

export function parseObjectResponse(responseText: string): {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- resolver schemas validate the parsed result
  value: any;
  explanation?: string;
} {
  const { json, explanation } = splitObjectResponse(responseText);

  try {
    let value;

    try {
      value = JSON.parse(json);
    } catch {
      value = JSON.parse(escapeStringControlCharacters(json));
    }

    return { value, explanation };
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);

    throw new AiResponseError(`AI response could not be read as JSON: ${reason}`, responseText);
  }
}
