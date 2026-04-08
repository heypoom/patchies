import { parser } from 'lezer-glsl';
import {
  continuedIndent,
  delimitedIndent,
  indentNodeProp,
  foldNodeProp,
  foldInside,
  LRLanguage
} from '@codemirror/language';
import { ViewPlugin, EditorView, Decoration, type DecorationSet } from '@codemirror/view';
import { RangeSetBuilder } from '@codemirror/state';

export const glslLanguage = LRLanguage.define({
  name: 'glsl',
  parser: parser.configure({
    props: [
      indentNodeProp.add({
        IfStatement: continuedIndent({ except: /^\s*({|else\b)/ }),
        CaseStatement: (context) => context.baseIndent + context.unit,
        BlockComment: () => null,
        CompoundStatement: delimitedIndent({ closing: '}' }),
        Statement: continuedIndent({ except: /^{/ })
      }),
      foldNodeProp.add({
        'StructDeclarationList CompoundStatement': foldInside,
        BlockComment(tree) {
          return { from: tree.from + 2, to: tree.to - 2 };
        }
      })
    ]
  }),
  languageData: {
    commentTokens: { line: '//', block: { open: '/*', close: '*/' } },
    indentOnInput: /^\s*(?:case |default:|\{|\})$/,
    closeBrackets: {
      stringPrefixes: ['L', 'u', 'U', 'u8', 'LR', 'UR', 'uR', 'u8R', 'R']
    }
  }
});

/**
 * Highlights #include directives that lezer-glsl mis-parses
 * (angle-bracket includes like `<lygia/...>` produce error nodes).
 */
const INCLUDE_LINE_RE = /^[ \t]*#include\s+(?:<([^>]+)>|"([^"]+)")/gm;

const includeDirectiveMark = Decoration.mark({ class: 'cm-glsl-include-directive' });
const includePathMark = Decoration.mark({ class: 'cm-glsl-include-path' });

function buildIncludeDecorations(view: EditorView): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();
  const doc = view.state.doc;

  for (let i = 1; i <= doc.lines; i++) {
    const line = doc.line(i);
    INCLUDE_LINE_RE.lastIndex = 0;
    const m = INCLUDE_LINE_RE.exec(line.text);

    if (!m) continue;

    const fullMatch = m[0];
    const directiveStart = line.from + m.index;

    // #include keyword
    const includeIdx = fullMatch.indexOf('#');
    const hashIncludeEnd = directiveStart + includeIdx + '#include'.length;
    builder.add(directiveStart + includeIdx, hashIncludeEnd, includeDirectiveMark);

    // path portion (<...> or "...")
    const pathChar = m[1] ? '<' : '"';
    const pathOffset = fullMatch.indexOf(pathChar);
    builder.add(directiveStart + pathOffset, directiveStart + fullMatch.length, includePathMark);
  }

  return builder.finish();
}

const includeHighlightTheme = EditorView.baseTheme({
  '.cm-glsl-include-directive, .cm-glsl-include-directive *': { color: '#89ddff !important' },
  '.cm-glsl-include-path, .cm-glsl-include-path *': { color: '#9ece6a !important' }
});

export const glslIncludeHighlighter = [
  ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;
      constructor(view: EditorView) {
        this.decorations = buildIncludeDecorations(view);
      }
      update(update: import('@codemirror/view').ViewUpdate) {
        if (update.docChanged || update.viewportChanged) {
          this.decorations = buildIncludeDecorations(update.view);
        }
      }
    },
    { decorations: (v) => v.decorations }
  ),
  includeHighlightTheme
];
