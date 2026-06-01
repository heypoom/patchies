import { describe, expect, it } from 'vitest';

import { stripJavaScriptComments } from './javascript-comments';

describe('stripJavaScriptComments', () => {
  it('removes line comments', () => {
    expect(stripJavaScriptComments("setTitle('x');\n// setSize(270, 390);\nnoDrag();")).toBe(
      "setTitle('x');\n\nnoDrag();"
    );
  });

  it('removes block comments while preserving line breaks', () => {
    expect(stripJavaScriptComments("setTitle('x');\n/* setSize(270,\n390); */\nnoDrag();")).toBe(
      "setTitle('x');\n\n\nnoDrag();"
    );
  });

  it('keeps comment markers inside string literals', () => {
    expect(stripJavaScriptComments("const label = '// setSize(270, 390)';\nsetSize(1, 2);")).toBe(
      "const label = '// setSize(270, 390)';\nsetSize(1, 2);"
    );
  });
});
