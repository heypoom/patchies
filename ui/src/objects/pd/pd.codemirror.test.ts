import { classHighlighter, highlightTree } from '@lezer/highlight';
import { toggleComment } from '@codemirror/commands';
import { EditorState } from '@codemirror/state';
import { describe, expect, it } from 'vitest';
import { pdLanguage, pureData } from './pd.codemirror';

const highlightedTokens = (code: string): Record<string, string> => {
  const tokens: Record<string, string> = {};

  highlightTree(pdLanguage.parser.parse(code), classHighlighter, (from, to, classes) => {
    tokens[code.slice(from, to)] = classes;
  });

  return tokens;
};

describe('Pure Data CodeMirror language', () => {
  it('highlights directives, records, coordinates, object names, and arguments', () => {
    const tokens = highlightedTokens('#X obj 20 40 osc~ 440;');

    expect(tokens['#X']).toBe('tok-keyword');
    expect(tokens.obj).toBe('tok-typeName');
    expect(tokens['20']).toBe('tok-number');
    expect(tokens['40']).toBe('tok-number');
    expect(tokens['osc~']).toBe('tok-variableName');
    expect(tokens['440']).toBe('tok-number');
  });

  it('highlights message atoms, substitutions, escapes, and text records', () => {
    const code = '#X msg 20 40 \\$0-level 0.5 \\, done;\n#X text 20 80 volume control;';
    const tokens = highlightedTokens(code);

    expect(tokens['\\$0-level']).toBe('tok-variableName');
    expect(tokens['\\,']).toBe('tok-string');
    expect(tokens.done).toBe('tok-string');
    expect(tokens['volume control;']).toBe('tok-comment');
  });

  it('highlights Patchies line comments', () => {
    const tokens = highlightedTokens('// #X obj 20 40 osc~ 440;');

    expect(tokens['// #X obj 20 40 osc~ 440;']).toBe('tok-comment');
  });

  it('supports the default Mod-/ comment command', () => {
    let state = EditorState.create({
      doc: '#X obj 20 40 osc~ 440;',
      extensions: [pureData()]
    });

    const handled = toggleComment({
      state,
      dispatch: (transaction) => {
        state = transaction.state;
      }
    } as Parameters<typeof toggleComment>[0]);

    expect(handled).toBe(true);
    expect(state.doc.toString()).toBe('// #X obj 20 40 osc~ 440;');
  });
});
