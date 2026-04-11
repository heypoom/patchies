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

    const match = INCLUDE_LINE_RE.exec(line.text);
    if (!match) continue;

    const fullMatch = match[0];
    const directiveStart = line.from + match.index;

    // #include keyword
    const includeIdx = fullMatch.indexOf('#');
    const hashIncludeEnd = directiveStart + includeIdx + '#include'.length;
    builder.add(directiveStart + includeIdx, hashIncludeEnd, includeDirectiveMark);

    // path portion (<...> or "...")
    const pathChar = match[1] ? '<' : '"';
    const pathOffset = fullMatch.indexOf(pathChar);
    builder.add(directiveStart + pathOffset, directiveStart + fullMatch.length, includePathMark);
  }

  return builder.finish();
}

const includeHighlightTheme = EditorView.baseTheme({
  '.cm-glsl-include-directive, .cm-glsl-include-directive *': { color: '#89ddff !important' },
  '.cm-glsl-include-path, .cm-glsl-include-path *': { color: '#9ece6a !important' }
});

/**
 * Highlights `// @title`, `// @param`, and `// @primaryButton` metadata directives (spec 125).
 */
const METADATA_DIRECTIVE_RE = /^[ \t]*\/\/\s*(@(?:title|param|primaryButton))\s+(.+)$/gm;

const metadataKeywordMark = Decoration.mark({ class: 'cm-glsl-metadata-keyword' });
const metadataValueMark = Decoration.mark({ class: 'cm-glsl-metadata-value' });

function buildMetadataDecorations(view: EditorView): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();
  const doc = view.state.doc;

  for (let i = 1; i <= doc.lines; i++) {
    const line = doc.line(i);
    METADATA_DIRECTIVE_RE.lastIndex = 0;

    const match = METADATA_DIRECTIVE_RE.exec(line.text);
    if (!match) continue;

    const lineStart = line.from + match.index;

    // @title or @param keyword
    const keywordStart = lineStart + match[0].indexOf(match[1]);
    builder.add(keywordStart, keywordStart + match[1].length, metadataKeywordMark);

    // value portion
    const valueStart = keywordStart + match[1].length + 1;
    const valueEnd = lineStart + match[0].length;

    if (valueStart < valueEnd) {
      builder.add(valueStart, valueEnd, metadataValueMark);
    }
  }

  return builder.finish();
}

const metadataHighlightTheme = EditorView.baseTheme({
  '.cm-glsl-metadata-keyword, .cm-glsl-metadata-keyword *': { color: '#6b7280 !important' },
  '.cm-glsl-metadata-value, .cm-glsl-metadata-value *': { color: '#8b95a5 !important' }
});

/**
 * Highlights `// @format rgba32f` directives that control FBO texture format.
 */
const FORMAT_DIRECTIVE_RE = /^[ \t]*\/\/\s*(@format)\s+(rgba8|rgba16f|rgba32f)/gm;

const formatKeywordMark = Decoration.mark({ class: 'cm-glsl-format-keyword' });
const formatValueMark = Decoration.mark({ class: 'cm-glsl-format-value' });

function buildFormatDecorations(view: EditorView): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();
  const doc = view.state.doc;

  for (let i = 1; i <= doc.lines; i++) {
    const line = doc.line(i);
    FORMAT_DIRECTIVE_RE.lastIndex = 0;
    const m = FORMAT_DIRECTIVE_RE.exec(line.text);
    if (!m) continue;

    const lineStart = line.from + m.index;
    // @format keyword
    const kwStart = lineStart + m[0].indexOf('@format');
    builder.add(kwStart, kwStart + '@format'.length, formatKeywordMark);
    // value (rgba8/rgba16f/rgba32f)
    const valStart = lineStart + m[0].indexOf(m[2], m[0].indexOf('@format'));
    builder.add(valStart, valStart + m[2].length, formatValueMark);
  }

  return builder.finish();
}

const formatHighlightTheme = EditorView.baseTheme({
  '.cm-glsl-format-keyword, .cm-glsl-format-keyword *': { color: '#6b7280 !important' },
  '.cm-glsl-format-value, .cm-glsl-format-value *': { color: '#8b95a5 !important' }
});

function decorationPlugin(build: (view: EditorView) => DecorationSet) {
  return ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;
      constructor(view: EditorView) {
        this.decorations = build(view);
      }
      update(update: import('@codemirror/view').ViewUpdate) {
        if (update.docChanged || update.viewportChanged) {
          this.decorations = build(update.view);
        }
      }
    },
    { decorations: (v) => v.decorations }
  );
}

export const glslIncludeHighlighter = [
  decorationPlugin(buildIncludeDecorations),
  decorationPlugin(buildFormatDecorations),
  decorationPlugin(buildMetadataDecorations),
  includeHighlightTheme,
  formatHighlightTheme,
  metadataHighlightTheme
];
