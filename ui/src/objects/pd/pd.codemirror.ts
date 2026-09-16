import {
  LanguageSupport,
  StreamLanguage,
  type StreamParser,
  type StringStream
} from '@codemirror/language';

type PdHighlightState = {
  directive: '#N' | '#X' | '#A' | '';
  field: number;
  record: string;
};

const resetLine = (state: PdHighlightState): void => {
  state.directive = '';
  state.field = 0;
  state.record = '';
};

const pdParser: StreamParser<PdHighlightState> = {
  name: 'puredata',
  languageData: { commentTokens: { line: '//' } },
  startState: () => ({ directive: '', field: 0, record: '' }),
  token(stream: StringStream, state: PdHighlightState) {
    if (stream.sol()) resetLine(state);

    if (stream.sol() && stream.match(/\s*\/\/.*$/)) return 'comment';
    if (stream.eatSpace()) return null;

    if (state.record === 'text' && state.field >= 4) {
      stream.skipToEnd();

      return 'comment';
    }

    if (stream.match(/#[NXA](?=\s)/)) {
      state.directive = stream.current() as PdHighlightState['directive'];
      state.field += 1;

      return 'keyword';
    }

    if (stream.match(';')) return 'operator';

    const field = state.field;
    state.field += 1;

    if (stream.match(/[-+]?(?:(?:\d+\.?\d*)|(?:\.\d+))(?:e[-+]?\d+)?/i)) {
      return 'number';
    }

    if (stream.match(/\\?\$(?:\d+|[a-zA-Z]\d*)[^\s;]*/)) return 'variableName';
    if (stream.match(/\\(?:[ ,;$\\])/)) return 'string';

    if (stream.match(/[^\s;]+/)) {
      const atom = stream.current();

      if (field === 1 && state.directive !== '#A') {
        state.record = atom;

        return 'typeName';
      }

      if (state.record === 'obj' && field === 4) return 'variableName';
      if (state.record === 'msg' && field >= 4) return 'string';

      return 'propertyName';
    }

    stream.next();

    return null;
  }
};

export const pdLanguage = StreamLanguage.define(pdParser);

export const pureData = (): LanguageSupport => new LanguageSupport(pdLanguage);
