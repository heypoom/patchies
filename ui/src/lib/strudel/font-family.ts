const CSS_FONT_KEYWORDS = new Set([
  'serif',
  'sans-serif',
  'monospace',
  'cursive',
  'fantasy',
  'system-ui',
  'ui-serif',
  'ui-sans-serif',
  'ui-monospace',
  'ui-rounded',
  'math',
  'emoji',
  'fangsong',
  'inherit',
  'initial',
  'unset',
  'revert',
  'revert-layer'
]);

export function normalizeStrudelFontFamily(value: string): string {
  const family = value.trim();
  const isQuoted =
    (family.startsWith('"') && family.endsWith('"')) ||
    (family.startsWith("'") && family.endsWith("'"));

  if (!family || isQuoted) return family;

  if (family.includes(',')) {
    const entries: string[] = [];
    let start = 0;
    let quote = '';
    let depth = 0;

    for (let index = 0; index < family.length; index++) {
      const char = family[index];

      if (char === '\\') {
        index++;
      } else if (quote) {
        if (char === quote) quote = '';
      } else if (char === '"' || char === "'") {
        quote = char;
      } else if (char === '(') {
        depth++;
      } else if (char === ')') {
        depth--;
      } else if (char === ',' && depth === 0) {
        entries.push(family.slice(start, index));
        start = index + 1;
      }
    }

    if (entries.length) {
      entries.push(family.slice(start));

      return entries.map(normalizeStrudelFontFamily).join(', ');
    }
  }

  if (CSS_FONT_KEYWORDS.has(family.toLowerCase()) || /^var\(/i.test(family)) {
    return family;
  }

  return `"${family.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}
