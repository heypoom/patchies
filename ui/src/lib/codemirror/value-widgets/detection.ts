import { syntaxTree } from '@codemirror/language';
import type { EditorState } from '@codemirror/state';
import type { Input, SyntaxNode, SyntaxNodeRef, Tree } from '@lezer/common';
import { javascriptLanguage } from '@codemirror/lang-javascript';
import { glslLanguage } from '$lib/codemirror/glsl.codemirror';
import { isGlslTemplateString } from '$lib/codemirror/glsl-in-js';
import type {
  EmbeddedRange,
  InlineValueComponent,
  InlineValueWidgetContext,
  InlineValueWidgetInfo,
  InlineValueWidgetKind,
  InlineValueWidgetLanguage,
  NumericSyntaxNode
} from './types';

export function readDoc(state: EditorState, from: number, to: number) {
  return state.doc.sliceString(from, to);
}

export function directChildren(node: SyntaxNode): SyntaxNode[] {
  const children: SyntaxNode[] = [];

  for (let child = node.firstChild; child; child = child.nextSibling) {
    children.push(child);
  }

  return children;
}

function isFiniteNumberText(text: string) {
  return /^-?(?:\d+\.?\d*|\.\d+)$/.test(text);
}

function numericComponentFromNode(
  state: EditorState,
  node: NumericSyntaxNode,
  offset = 0
): InlineValueComponent | null {
  if (node.name !== 'Number') return null;

  let from = node.from + offset;
  let to = node.to + offset;
  const parent = node.node?.parent ?? node.parent ?? null;

  if (parent?.name === 'UnaryExpression') {
    const parentText = readDoc(state, parent.from + offset, parent.to + offset);
    if (/^-\s*(?:\d+\.?\d*|\.\d+)$/.test(parentText)) {
      from = parent.from + offset;
      to = parent.to + offset;
    }
  }

  const text = readDoc(state, from, to);
  if (!isFiniteNumberText(text)) return null;

  return {
    from,
    to,
    text,
    value: Number(text)
  };
}

function isNormalized(components: InlineValueComponent[]) {
  return components.every((component) => component.value >= 0 && component.value <= 1);
}

function componentKey(component: InlineValueComponent) {
  return `${component.from}:${component.to}`;
}

function addVectorWidget(
  widgets: InlineValueWidgetInfo[],
  consumedNumbers: Set<string>,
  kind: Extract<InlineValueWidgetKind, 'xy' | 'color'>,
  state: EditorState,
  from: number,
  to: number,
  components: InlineValueComponent[],
  options: { colorPicker?: boolean } = {}
) {
  if (!isNormalized(components)) return;

  widgets.push({
    kind,
    from,
    to,
    text: readDoc(state, from, to),
    components,
    colorPicker: kind === 'color' ? options.colorPicker : undefined
  });

  components.forEach((component) => consumedNumbers.add(componentKey(component)));
}

function collectGlslValueWidgetsFromTree(
  state: EditorState,
  tree: Tree,
  from: number,
  to: number,
  offset = 0
) {
  const widgets: InlineValueWidgetInfo[] = [];
  const consumedNumbers = new Set<string>();

  tree.iterate({
    from,
    to,
    enter(node) {
      if (node.name !== 'CallExpression') return;

      const children = directChildren(node.node);
      const callee = children[0];
      const args = children.find((child) => child.name === 'ArgumentList');
      if (!callee || !args) return;

      const calleeText = readDoc(state, callee.from + offset, callee.to + offset);
      if (calleeText !== 'vec2' && calleeText !== 'vec3') return;

      const components = directChildren(args)
        .map((child) => numericComponentFromNode(state, child, offset))
        .filter((component): component is InlineValueComponent => component !== null);

      const expectedComponentCount = calleeText === 'vec2' ? 2 : 3;
      if (components.length !== expectedComponentCount) return;

      addVectorWidget(
        widgets,
        consumedNumbers,
        calleeText === 'vec2' ? 'xy' : 'color',
        state,
        node.from + offset,
        node.to + offset,
        components,
        { colorPicker: calleeText === 'vec3' }
      );
    }
  });

  tree.iterate({
    from,
    to,
    enter(node) {
      const component = numericComponentFromNode(state, node, offset);
      if (!component || consumedNumbers.has(componentKey(component))) return;

      widgets.push({
        kind: 'number',
        from: component.from,
        to: component.to,
        text: component.text,
        components: [component]
      });
    }
  });

  return widgets;
}

function collectJavaScriptValueWidgetsFromTree(
  state: EditorState,
  tree: Tree,
  context?: InlineValueWidgetContext
) {
  const widgets: InlineValueWidgetInfo[] = [];
  const consumedNumbers = new Set<string>();

  tree.iterate({
    enter(node) {
      if (node.name !== 'ArrayExpression' && node.name !== 'SequenceExpression') return;

      const bracketFrom = node.name === 'SequenceExpression' ? node.from - 1 : node.from;
      const bracketTo = node.name === 'SequenceExpression' ? node.to + 1 : node.to;

      if (
        bracketFrom < 0 ||
        bracketTo > state.doc.length ||
        readDoc(state, bracketFrom, bracketFrom + 1) !== '[' ||
        readDoc(state, bracketTo - 1, bracketTo) !== ']'
      ) {
        return;
      }

      const components = directChildren(node.node)
        .map((child) => numericComponentFromNode(state, child))
        .filter((component): component is InlineValueComponent => component !== null);

      if (components.length !== 2 && components.length !== 3) return;

      addVectorWidget(
        widgets,
        consumedNumbers,
        components.length === 2 ? 'xy' : 'color',
        state,
        bracketFrom,
        bracketTo,
        components
      );
    }
  });

  if (context?.nodeType === 'shaderpark') {
    tree.iterate({
      enter(node) {
        if (node.name !== 'CallExpression') return;

        const children = directChildren(node.node);
        const callee = children[0];
        const args = children.find((child) => child.name === 'ArgList');
        if (!callee || !args) return;

        const calleeText = readDoc(state, callee.from, callee.to);
        if (calleeText !== 'vec3' && calleeText !== 'color') return;

        const components = directChildren(args)
          .map((child) => numericComponentFromNode(state, child))
          .filter((component): component is InlineValueComponent => component !== null);

        if (components.length !== 3) return;

        addVectorWidget(widgets, consumedNumbers, 'color', state, node.from, node.to, components, {
          colorPicker: true
        });
      }
    });
  }

  tree.iterate({
    enter(node) {
      const component = numericComponentFromNode(state, node);
      if (!component || consumedNumbers.has(componentKey(component))) return;

      widgets.push({
        kind: 'number',
        from: component.from,
        to: component.to,
        text: component.text,
        components: [component]
      });
    }
  });

  return widgets;
}

function glslTemplateContentRanges(node: SyntaxNodeRef): EmbeddedRange[] {
  const ranges: EmbeddedRange[] = [];
  let pos = node.from + 1;
  const end = node.to - 1;

  for (let child = node.node.firstChild; child; child = child.nextSibling) {
    if (child.name === 'Interpolation') {
      if (pos < child.from) {
        ranges.push({ from: pos, to: child.from });
      }

      pos = child.to;
    }
  }

  if (pos < end) {
    ranges.push({ from: pos, to: end });
  }

  return ranges;
}

function findGlslInJsRanges(state: EditorState) {
  const doc = state.doc.toString();
  const input = {
    read: (from: number, to: number) => doc.slice(from, to)
  } as Input;
  const ranges: EmbeddedRange[] = [];
  const tree = javascriptLanguage.parser.parse(doc);

  tree.iterate({
    enter(node) {
      if (node.name !== 'TemplateString') return;
      if (!isGlslTemplateString(node, input)) return;

      ranges.push(...glslTemplateContentRanges(node));
    }
  });

  return ranges;
}

function collectPeppermintValueWidgets(state: EditorState) {
  const widgets: InlineValueWidgetInfo[] = [];
  const doc = state.doc.toString();
  const numberPattern = /-?(?:\d+\.?\d*|\.\d+)/g;
  let inString = false;
  let escaped = false;
  let lineStart = 0;

  for (const line of doc.split('\n')) {
    const visibleChars = Array.from(line, (char) => {
      if (inString) {
        if (char === '"' && !escaped) {
          inString = false;
        }
        escaped = char === '\\' && !escaped;
        return ' ';
      }

      if (char === '#') {
        return null;
      }

      if (char === '"') {
        inString = true;
        escaped = false;
        return ' ';
      }

      return char;
    });

    const commentIndex = visibleChars.indexOf(null);
    const searchable = visibleChars
      .slice(0, commentIndex === -1 ? visibleChars.length : commentIndex)
      .map((char) => char ?? ' ')
      .join('');

    for (const match of searchable.matchAll(numberPattern)) {
      if (match.index === undefined) continue;

      const text = match[0];
      const before = searchable[match.index - 1] ?? '';
      const after = searchable[match.index + text.length] ?? '';
      if (/[A-Za-z0-9_.]/.test(before) || /[A-Za-z0-9_]/.test(after)) continue;

      const from = lineStart + match.index;
      const to = from + text.length;
      const component = {
        from,
        to,
        text,
        value: Number(text)
      };

      widgets.push({
        kind: 'number',
        from,
        to,
        text,
        components: [component]
      });
    }

    lineStart += line.length + 1;
  }

  return widgets;
}

function isInsideAnyRange(widget: InlineValueWidgetInfo, ranges: EmbeddedRange[]) {
  return ranges.some((range) => widget.from >= range.from && widget.to <= range.to);
}

function compareWidgets(a: InlineValueWidgetInfo, b: InlineValueWidgetInfo) {
  return a.from - b.from || b.to - a.to;
}

export function findInlineValueWidgets(
  state: EditorState,
  language: InlineValueWidgetLanguage,
  context?: InlineValueWidgetContext
): InlineValueWidgetInfo[] {
  if (language === 'peppermint') {
    return collectPeppermintValueWidgets(state).sort(compareWidgets);
  }

  if (language === 'glsl') {
    const tree = syntaxTree(state);
    return collectGlslValueWidgetsFromTree(state, tree, 0, state.doc.length).sort(compareWidgets);
  }

  const glslRanges = findGlslInJsRanges(state);
  const jsWidgets = collectJavaScriptValueWidgetsFromTree(state, syntaxTree(state), context).filter(
    (widget) => !isInsideAnyRange(widget, glslRanges)
  );

  const glslWidgets = glslRanges.flatMap((range) => {
    const tree = glslLanguage.parser.parse(readDoc(state, range.from, range.to));
    return collectGlslValueWidgetsFromTree(state, tree, 0, range.to - range.from, range.from);
  });

  return [...jsWidgets, ...glslWidgets].sort(compareWidgets);
}
