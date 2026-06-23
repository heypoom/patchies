import { htmlLanguage } from '@codemirror/lang-html';
import { parseMixed } from '@lezer/common';
import type { Input, SyntaxNodeRef } from '@lezer/common';

const HTML_TAG = new Set(['html']);
const HTML_PROPERTY_KEYS = new Set(['template']);
const HTML_ASSIGNMENT_PROPERTY_NAMES = new Set(['innerHTML']);

function isHtmlTemplateProperty(node: SyntaxNodeRef, input: Input): boolean {
  const parent = node.node.parent;
  if (!parent || parent.name !== 'Property') return false;

  const key = parent.firstChild;

  return (
    !!key &&
    key.name === 'PropertyDefinition' &&
    HTML_PROPERTY_KEYS.has(input.read(key.from, key.to))
  );
}

function isHtmlAssignmentValue(node: SyntaxNodeRef, input: Input): boolean {
  const parent = node.node.parent;
  if (!parent || parent.name !== 'AssignmentExpression') return false;

  const target = parent.firstChild;
  const property = target?.lastChild;

  return (
    !!target &&
    target.name === 'MemberExpression' &&
    !!property &&
    property.name === 'PropertyName' &&
    HTML_ASSIGNMENT_PROPERTY_NAMES.has(input.read(property.from, property.to))
  );
}

export function isHtmlTemplateString(node: SyntaxNodeRef, input: Input): boolean {
  const parent = node.node.parent;
  if (!parent) return false;

  if (isHtmlAssignmentValue(node, input)) return true;
  if (isHtmlTemplateProperty(node, input)) return true;

  if (parent.name === 'TaggedTemplateExpression') {
    const tag = parent.firstChild;

    return !!tag && HTML_TAG.has(input.read(tag.from, tag.to));
  }

  return false;
}

export function templateContentOverlay(node: SyntaxNodeRef): { from: number; to: number }[] {
  const overlay: { from: number; to: number }[] = [];
  let pos = node.from + 1;

  for (let child = node.node.firstChild; child; child = child.nextSibling) {
    if (child.name === 'Interpolation') {
      if (pos < child.from) overlay.push({ from: pos, to: child.from });

      pos = child.to;
    }
  }

  const end = node.to - 1;
  if (pos < end) overlay.push({ from: pos, to: end });

  return overlay;
}

export function stringContentOverlay(node: SyntaxNodeRef): { from: number; to: number }[] {
  const from = node.from + 1;
  const to = node.to - 1;

  return from < to ? [{ from, to }] : [];
}

export const htmlInJsWrap = parseMixed((node, input) => {
  if (node.name !== 'TemplateString' && node.name !== 'String') return null;
  if (!isHtmlTemplateString(node, input)) return null;

  return {
    parser: htmlLanguage.parser,
    overlay:
      node.name === 'TemplateString' ? templateContentOverlay(node) : stringContentOverlay(node)
  };
});
