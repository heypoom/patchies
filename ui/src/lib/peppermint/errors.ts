export type FormattedPeppermintError = {
  message: string;
  lineErrors?: Record<number, string[]>;
};

const PEPPERMINT_ERROR_LINE =
  /peppermint\.[\w.]+\.([A-Za-z]+Error): (?:Parse error at )?(\d+):(\d+): (.+)$/;

export function formatPeppermintError(rawError: string, source: string): FormattedPeppermintError {
  const relevantLine = getRelevantErrorLine(rawError);
  const match = relevantLine.match(PEPPERMINT_ERROR_LINE);

  if (!match) {
    return { message: relevantLine };
  }

  const [, errorName, lineText, columnText, detail] = match;
  const line = Number(lineText);
  const column = Number(columnText);
  const displayName = errorName.replace(/Error$/, '').toLowerCase();
  const sourceLine = source.split('\n')[line - 1] ?? '';
  const caret = `${' '.repeat(String(line).length + 3 + Math.max(column - 1, 0))}^`;
  const parts = [
    `Peppermint ${displayName} error at line ${line}, column ${column}: ${detail}`,
    '',
    `${line} | ${sourceLine}`,
    caret
  ];
  const tip = getTip(detail);
  if (tip) {
    parts.push('', tip);
  }
  const message = parts.join('\n');

  return {
    message,
    lineErrors: {
      [line]: [detail]
    }
  };
}

function getRelevantErrorLine(rawError: string) {
  const lines = rawError
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  return lines.findLast((line) => line.startsWith('peppermint.')) ?? lines.at(-1) ?? rawError;
}

function getTip(detail: string) {
  if (detail.includes('ARROW')) {
    return 'Tip: In a pipe, call a function such as `|> add(foo: it)`.';
  }

  return '';
}
