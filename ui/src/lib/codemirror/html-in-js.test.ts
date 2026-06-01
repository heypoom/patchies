import type { Input, SyntaxNodeRef } from '@lezer/common';
import { javascriptLanguage } from '@codemirror/lang-javascript';
import { describe, expect, it } from 'vitest';
import { htmlInJsWrap, isHtmlTemplateString } from '$lib/codemirror/html-in-js';
import { javascriptMixedWrap } from '$lib/codemirror/javascript-mixed';

function findTemplateStrings(doc: string) {
  const input = {
    read: (from: number, to: number) => doc.slice(from, to)
  } as Input;

  const results: boolean[] = [];

  javascriptLanguage.parser.parse(doc).iterate({
    enter(node: SyntaxNodeRef) {
      if (node.name === 'TemplateString') {
        results.push(isHtmlTemplateString(node, input));
      }
    }
  });

  return results;
}

function getInnerNodeNameAt(doc: string, searchText: string) {
  const parser = javascriptLanguage.configure({ wrap: htmlInJsWrap }).parser;
  const tree = parser.parse(doc);
  const pos = doc.indexOf(searchText);

  return tree.resolveInner(pos + 1, 1).name;
}

function getMixedLanguageInnerNodeNameAt(doc: string, searchText: string) {
  const parser = javascriptLanguage.configure({ wrap: javascriptMixedWrap }).parser;
  const tree = parser.parse(doc);
  const pos = doc.indexOf(searchText);

  return tree.resolveInner(pos + 1, 1).name;
}

describe('html in js mixed parsing', () => {
  it('detects html tagged template strings as HTML bodies', () => {
    expect(findTemplateStrings('const view = html`<main><h1>Hello</h1></main>`;')).toEqual([true]);
  });

  it('keeps unrelated template strings in JavaScript mode', () => {
    expect(findTemplateStrings('const view = css`main { color: red; }`;')).toEqual([false]);
    expect(findTemplateStrings('const view = render`<main>Hello</main>`;')).toEqual([false]);
  });

  it('parses non-interpolation template content as HTML', () => {
    const doc = 'const view = html`<main class="card"><h1>${title}</h1></main>`;';

    expect(getInnerNodeNameAt(doc, 'main')).toBe('TagName');
    expect(getInnerNodeNameAt(doc, 'class')).toBe('AttributeName');
    expect(getInnerNodeNameAt(doc, 'title')).toBe('VariableName');
  });

  it('parses createApp template string properties as HTML', () => {
    const doc =
      'createApp({ template: \'<div class="px-3 py-1 text-green-400">{{ message }}</div>\' });';

    expect(getInnerNodeNameAt(doc, 'div')).toBe('TagName');
    expect(getInnerNodeNameAt(doc, 'class')).toBe('AttributeName');
  });

  it('parses createApp template string properties with backticks as HTML', () => {
    const doc = 'createApp({ template: `<div class="px-3">${message}</div>` });';

    expect(getInnerNodeNameAt(doc, 'div')).toBe('TagName');
    expect(getInnerNodeNameAt(doc, 'class')).toBe('AttributeName');
    expect(getInnerNodeNameAt(doc, 'message')).toBe('VariableName');
  });

  it('parses innerHTML assignment strings as HTML', () => {
    const doc = 'el.innerHTML = \'<section class="panel"><button>Run</button></section>\';';

    expect(getInnerNodeNameAt(doc, 'section')).toBe('TagName');
    expect(getInnerNodeNameAt(doc, 'class')).toBe('AttributeName');
    expect(getInnerNodeNameAt(doc, 'button')).toBe('TagName');
  });

  it('parses innerHTML assignment template strings as HTML', () => {
    const doc = 'el.innerHTML = `<section class="panel">${content}</section>`;';

    expect(getInnerNodeNameAt(doc, 'section')).toBe('TagName');
    expect(getInnerNodeNameAt(doc, 'class')).toBe('AttributeName');
    expect(getInnerNodeNameAt(doc, 'content')).toBe('VariableName');
  });

  it('coexists with GLSL mixed parsing in JavaScript', () => {
    expect(getMixedLanguageInnerNodeNameAt('const view = html`<main></main>`;', 'main')).toBe(
      'TagName'
    );
    expect(getMixedLanguageInnerNodeNameAt('const shader = glsl`vec2 p = uv;`;', 'vec2')).toBe(
      'PrimitiveType'
    );
  });
});
