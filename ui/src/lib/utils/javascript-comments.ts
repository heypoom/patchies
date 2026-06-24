export function stripJavaScriptComments(code: string): string {
  let output = '';
  let quote: '"' | "'" | '`' | null = null;
  let escaped = false;

  for (let index = 0; index < code.length; index += 1) {
    const char = code[index];
    const nextChar = code[index + 1];

    if (quote) {
      output += char;

      if (escaped) {
        escaped = false;
      } else if (char === '\\') {
        escaped = true;
      } else if (char === quote) {
        quote = null;
      }

      continue;
    }

    if (char === '"' || char === "'" || char === '`') {
      quote = char;
      output += char;
      continue;
    }

    if (char === '/' && nextChar === '/') {
      while (index < code.length && code[index] !== '\n') {
        index += 1;
      }
      output += '\n';
      continue;
    }

    if (char === '/' && nextChar === '*') {
      index += 2;
      while (index < code.length && !(code[index] === '*' && code[index + 1] === '/')) {
        if (code[index] === '\n') {
          output += '\n';
        }
        index += 1;
      }
      index += 1;
      continue;
    }

    output += char;
  }

  return output;
}

export function stripJavaScriptStrings(code: string): string {
  let output = '';
  let quote: '"' | "'" | '`' | null = null;
  let escaped = false;

  for (let index = 0; index < code.length; index += 1) {
    const char = code[index];

    if (quote) {
      if (escaped) {
        escaped = false;
      } else if (char === '\\') {
        escaped = true;
      } else if (char === quote) {
        quote = null;
      }

      output += char === '\n' ? '\n' : ' ';

      continue;
    }

    if (char === '"' || char === "'" || char === '`') {
      quote = char;
      output += ' ';

      continue;
    }

    output += char;
  }

  return output;
}
