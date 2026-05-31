import {
  HighlightStyle,
  LanguageSupport,
  StreamLanguage,
  syntaxHighlighting,
  type StreamParser,
  type StringStream
} from '@codemirror/language';
import type { Completion, CompletionContext, CompletionResult } from '@codemirror/autocomplete';
import { tags } from '@lezer/highlight';

type PeppermintState = {
  inString: boolean;
};

const peppermintParser: StreamParser<PeppermintState> = {
  name: 'peppermint',
  startState: () => ({ inString: false }),
  token(stream: StringStream, state: PeppermintState) {
    if (stream.eatSpace()) return null;

    if (state.inString) {
      let escaped = false;
      while (!stream.eol()) {
        const ch = stream.next();
        if (ch === '"' && !escaped) {
          state.inString = false;
          break;
        }
        escaped = ch === '\\' && !escaped;
      }
      return 'string';
    }

    if (stream.match(/#[^\n]*/)) return 'comment';

    if (stream.peek() === '"') {
      stream.next();
      state.inString = true;
      return 'string';
    }

    if (stream.match(/\b\d+\.\d+\b/) || stream.match(/\b\d+\b/)) return 'number';
    if (stream.match(/\b(match|use|as|ns|quiet|and|or|not)\b/)) return 'keyword';
    if (stream.match(/\b(true|false|none)\b/)) return 'atom';
    if (stream.match(/\b(Ok|Err)\b/)) return 'typeName';
    if (stream.match(/\b(it|col|_)\b/)) return 'variableName';
    if (stream.match(/\b[A-Za-z_][A-Za-z0-9_]*(?=\.)/)) return 'namespace';
    if (stream.match(/(?<=\.)[A-Za-z_][A-Za-z0-9_]*/)) return 'propertyName';
    if (stream.match(/\b[A-Za-z_][A-Za-z0-9_]*(?=\s*\()/)) return 'variableName';
    if (stream.match(/\|>|->|\.\.\.|\.{2}|>=|<=|==|!=|[+\-*/%<>=]/)) return 'operator';
    if (stream.match(/\b[A-Za-z_][A-Za-z0-9_]*\b/)) return 'variableName';

    stream.next();
    return null;
  },
  languageData: {
    commentTokens: { line: '#' }
  }
};

export const peppermintLanguage = StreamLanguage.define(peppermintParser);

const peppermintHighlightStyle = HighlightStyle.define([
  { tag: tags.keyword, color: '#7dcfff' },
  { tag: tags.atom, color: '#ff9e64' },
  { tag: tags.number, color: '#ff9e64' },
  { tag: tags.string, color: '#9ece6a' },
  { tag: tags.comment, color: '#565f89' },
  { tag: tags.operator, color: '#bb9af7' },
  { tag: tags.function(tags.variableName), color: '#7aa2f7' },
  { tag: tags.typeName, color: '#e0af68' },
  { tag: tags.namespace, color: '#c0caf5' },
  { tag: tags.propertyName, color: '#c0caf5' },
  { tag: tags.variableName, color: '#f7768e' }
]);

const keywordCompletions: Completion[] = [
  { label: 'match', type: 'keyword', info: 'Pattern match on a value.' },
  { label: 'use', type: 'keyword', info: 'Import a Peppermint standard library namespace.' },
  { label: 'as', type: 'keyword', info: 'Give an imported namespace an alias.' },
  { label: 'ns', type: 'keyword', info: 'Declare a namespace.' },
  { label: 'quiet', type: 'keyword', info: 'Suppress pipe step summary output.' },
  { label: 'true', type: 'constant', info: 'Boolean true.' },
  { label: 'false', type: 'constant', info: 'Boolean false.' },
  { label: 'none', type: 'constant', info: 'Null / no value.' },
  {
    label: 'it',
    type: 'variable',
    detail: 'current row/item',
    info: 'Current element in row-wise expressions.'
  },
  {
    label: 'col',
    type: 'variable',
    detail: 'column reference',
    info: 'Reference a column by name in aggregate expressions.'
  }
];

const functionCompletions: Completion[] = [
  {
    label: 'input',
    type: 'function',
    detail: 'input() -> Any',
    info: 'Read the latest inbound Patchies message. Returns none before the first input.'
  },
  {
    label: 'print',
    type: 'function',
    detail: 'print(value: Any) -> Any',
    info: 'Print a value to the virtual console and pass it through unchanged.'
  },
  {
    label: 'send',
    type: 'function',
    detail: 'send(value: Any) -> Any',
    info: 'Send a value from the peppermint object and pass it through unchanged.'
  },
  {
    label: 'filter',
    type: 'function',
    detail: 'filter(pred: Expr) -> List<Row>',
    info: 'Keep rows where the predicate is true.'
  },
  {
    label: 'map',
    type: 'function',
    detail: 'map(expr: Expr) -> List<Any>',
    info: 'Transform every item with an expression.'
  },
  {
    label: 'mapi',
    type: 'function',
    detail: 'mapi(expr: Expr) -> List<Any>',
    info: 'Transform every item with index and value available as it.idx and it.val.'
  },
  {
    label: 'add',
    type: 'function',
    detail: 'add(field: Expr, ...) -> List<Row>',
    info: 'Add one or more computed fields to every row.'
  },
  {
    label: 'drop',
    type: 'function',
    detail: 'drop(field: str, ...) -> List<Row>',
    info: 'Remove one or more fields from every row.'
  },
  {
    label: 'select',
    type: 'function',
    detail: 'select(fields: str..., renamed?: Expr)',
    info: 'Keep selected fields and optionally compute renamed fields.'
  },
  {
    label: 'rename',
    type: 'function',
    detail: 'rename(old: new) -> List<Row>',
    info: 'Rename a field.'
  },
  {
    label: 'sort',
    type: 'function',
    detail: 'sort(by: str, dir?: "asc" | "desc")',
    info: 'Sort rows by a field.'
  },
  {
    label: 'take',
    type: 'function',
    detail: 'take(n: Int) -> List<Row>',
    info: 'Keep the first n rows.'
  },
  {
    label: 'collapse',
    type: 'function',
    detail: 'collapse(by?: str, ...agg)',
    info: 'Group rows and compute aggregate values.'
  },
  {
    label: 'sum',
    type: 'function',
    detail: 'sum(col.field) -> AggFn',
    info: 'Aggregate by summing a column.'
  },
  {
    label: 'mean',
    type: 'function',
    detail: 'mean(col.field) -> AggFn',
    info: 'Aggregate by averaging a column.'
  },
  {
    label: 'count',
    type: 'function',
    detail: 'count() -> AggFn',
    info: 'Aggregate by counting rows.'
  },
  {
    label: 'min',
    type: 'function',
    detail: 'min(col.field) -> AggFn',
    info: 'Aggregate with the minimum column value.'
  },
  {
    label: 'max',
    type: 'function',
    detail: 'max(col.field) -> AggFn',
    info: 'Aggregate with the maximum column value.'
  },
  {
    label: 'len',
    type: 'function',
    detail: 'len(list: List<Any>) -> Int',
    info: 'Return the length of a list.'
  },
  {
    label: 'unique',
    type: 'function',
    detail: 'unique(by: str) -> List<Row>',
    info: 'Keep unique rows by a field.'
  },
  {
    label: 'slice',
    type: 'function',
    detail: 'slice(list, start, end)',
    info: 'Return a list slice.'
  },
  {
    label: 'concat',
    type: 'function',
    detail: 'concat(a, b, ...) -> List<Any>',
    info: 'Concatenate multiple lists.'
  }
];

const operatorCompletions: Completion[] = [
  { label: '|>', type: 'operator', detail: 'pipe' },
  { label: '->', type: 'operator', detail: 'lambda' }
];

const peppermintCompletionOptions = [
  ...keywordCompletions,
  ...functionCompletions,
  ...operatorCompletions
];

export function peppermintCompletions(context: CompletionContext): CompletionResult | null {
  const token = context.matchBefore(/[\w|>-]*/);

  if (!token || (token.from === token.to && !context.explicit)) {
    return null;
  }

  return {
    from: token.from,
    options: peppermintCompletionOptions,
    validFor: /^[\w|>-]*$/
  };
}

export function getPeppermintCompletionByLabel(label: string): Completion | undefined {
  return peppermintCompletionOptions.find((completion) => completion.label === label);
}

export function peppermint(): LanguageSupport {
  return new LanguageSupport(peppermintLanguage, [syntaxHighlighting(peppermintHighlightStyle)]);
}
