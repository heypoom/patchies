import { htmlLanguage } from '@codemirror/lang-html';
import { parseMixed } from '@lezer/common';
import { glslLanguage } from '$lib/codemirror/glsl.codemirror';
import { isGlslTemplateString } from '$lib/codemirror/glsl-in-js';
import { isHtmlTemplateString, templateContentOverlay } from '$lib/codemirror/html-in-js';

function stringContentOverlay(
  node: import('@lezer/common').SyntaxNodeRef
): { from: number; to: number }[] {
  return [{ from: node.from + 1, to: node.to - 1 }];
}

export const javascriptMixedWrap = parseMixed((node, input) => {
  if (node.name !== 'TemplateString' && node.name !== 'String') return null;

  if (node.name === 'TemplateString' && isGlslTemplateString(node, input)) {
    return { parser: glslLanguage.parser, overlay: templateContentOverlay(node) };
  }

  if (isHtmlTemplateString(node, input)) {
    return {
      parser: htmlLanguage.parser,
      overlay:
        node.name === 'TemplateString' ? templateContentOverlay(node) : stringContentOverlay(node)
    };
  }

  return null;
});
