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

  if (
    !family ||
    family.includes(',') ||
    isQuoted ||
    CSS_FONT_KEYWORDS.has(family.toLowerCase()) ||
    /^var\(/i.test(family)
  ) {
    return family;
  }

  return `"${family.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}
