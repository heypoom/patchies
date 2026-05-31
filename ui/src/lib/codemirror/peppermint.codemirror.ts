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
    if (stream.match(/\b(it|col|_)\b/)) return 'variableName.special';
    if (stream.match(/\b[A-Za-z_][A-Za-z0-9_]*(?=\.)/)) return 'namespace';
    if (stream.match(/(?<=\.)[A-Za-z_][A-Za-z0-9_]*/)) return 'propertyName';
    if (stream.match(/\b[A-Za-z_][A-Za-z0-9_]*(?=\s*\()/)) return 'function';
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
  { tag: tags.special(tags.variableName), color: '#f7768e' }
]);

const keywordCompletions: Completion[] = [
  { label: 'match', type: 'keyword' },
  { label: 'use', type: 'keyword' },
  { label: 'as', type: 'keyword' },
  { label: 'ns', type: 'keyword' },
  { label: 'quiet', type: 'keyword' },
  { label: 'true', type: 'constant' },
  { label: 'false', type: 'constant' },
  { label: 'none', type: 'constant' },
  { label: 'it', type: 'variable', detail: 'current row/item' },
  { label: 'col', type: 'variable', detail: 'column reference' }
];

const functionCompletions: Completion[] = [
  { label: 'input', type: 'function', detail: 'input() -> Any' },
  { label: 'print', type: 'function', detail: 'print(value: Any) -> Any' },
  { label: 'filter', type: 'function', detail: 'filter(pred: Expr) -> List<Row>' },
  { label: 'map', type: 'function', detail: 'map(expr: Expr) -> List<Any>' },
  { label: 'mapi', type: 'function', detail: 'mapi(expr: Expr) -> List<Any>' },
  { label: 'add', type: 'function', detail: 'add(field: Expr, ...) -> List<Row>' },
  { label: 'drop', type: 'function', detail: 'drop(field: str, ...) -> List<Row>' },
  { label: 'select', type: 'function', detail: 'select(fields: str..., renamed?: Expr)' },
  { label: 'rename', type: 'function', detail: 'rename(old: new) -> List<Row>' },
  { label: 'sort', type: 'function', detail: 'sort(by: str, dir?: "asc" | "desc")' },
  { label: 'take', type: 'function', detail: 'take(n: Int) -> List<Row>' },
  { label: 'collapse', type: 'function', detail: 'collapse(by?: str, ...agg)' },
  { label: 'sum', type: 'function', detail: 'sum(col.field) -> AggFn' },
  { label: 'mean', type: 'function', detail: 'mean(col.field) -> AggFn' },
  { label: 'count', type: 'function', detail: 'count() -> AggFn' },
  { label: 'min', type: 'function', detail: 'min(col.field) -> AggFn' },
  { label: 'max', type: 'function', detail: 'max(col.field) -> AggFn' },
  { label: 'len', type: 'function', detail: 'len(list: List<Any>) -> Int' },
  { label: 'unique', type: 'function', detail: 'unique(by: str) -> List<Row>' },
  { label: 'slice', type: 'function', detail: 'slice(list, start, end)' },
  { label: 'concat', type: 'function', detail: 'concat(a, b, ...) -> List<Any>' }
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

export function peppermint(): LanguageSupport {
  return new LanguageSupport(peppermintLanguage, [syntaxHighlighting(peppermintHighlightStyle)]);
}
