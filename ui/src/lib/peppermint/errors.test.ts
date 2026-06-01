import { describe, expect, it } from 'vitest';
import { formatPeppermintError } from './errors';

describe('formatPeppermintError', () => {
  it('turns Python tracebacks with Peppermint parse errors into a short code-frame message', () => {
    const source = `input()
  |> x -> add(foo: x)
  |> send`;

    const error = `PythonError: Traceback (most recent call last):
  File "/lib/python3.13/site-packages/peppermint/parser.py", line 561, in _parse_atom
    raise ParseError(f"unexpected token {tok.type} ({tok.value!r})", tok.line, tok.col)
peppermint.parser.ParseError: Parse error at 2:8: unexpected token ARROW ('->')`;

    expect(formatPeppermintError(error, source)).toEqual({
      message: [
        "Peppermint parse error at line 2, column 8: unexpected token ARROW ('->')",
        '',
        '2 |   |> x -> add(foo: x)',
        '           ^',
        '',
        'Tip: In a pipe, call a function such as `|> add(foo: it)`.'
      ].join('\n'),
      lineErrors: {
        2: ["unexpected token ARROW ('->')"]
      }
    });
  });

  it('falls back to the last traceback line when the error has no Peppermint location', () => {
    expect(
      formatPeppermintError(
        `PythonError: Traceback (most recent call last):
ValueError: something went wrong`,
        'input() |> send'
      )
    ).toEqual({
      message: 'ValueError: something went wrong'
    });
  });
});
