import type { CompletionContext as CMCompletionContext } from '@codemirror/autocomplete';

export function isCompletionSuppressedByComment(
  context: CMCompletionContext,
  from: number
): boolean {
  const line = context.state.doc.lineAt(context.pos);
  const lineText = line.text;
  const posInLine = context.pos - line.from;

  const commentStart = lineText.indexOf('//');
  if (commentStart !== -1 && posInLine > commentStart) {
    return true;
  }

  const textBefore = context.state.doc.sliceString(Math.max(0, from - 100), from);
  const lastBlockCommentStart = textBefore.lastIndexOf('/*');
  const lastBlockCommentEnd = textBefore.lastIndexOf('*/');

  return lastBlockCommentStart > lastBlockCommentEnd;
}
