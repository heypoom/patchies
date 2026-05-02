import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

describe('SliderNode styling', () => {
  it('keeps vertical sliders on the shared cross-browser range styling path', () => {
    const source = readFileSync(
      fileURLToPath(new URL('./SliderNode.svelte', import.meta.url)),
      'utf8'
    );

    expect(source).not.toContain("if (node.data.vertical) {\n      return '';");
    expect(source).toContain("'slider-input");
  });

  it('keeps the vertical track narrow instead of reusing horizontal full width', () => {
    const source = readFileSync(
      fileURLToPath(new URL('./SliderNode.svelte', import.meta.url)),
      'utf8'
    );

    expect(source).toContain("node.data.vertical ? 'w-1' : 'h-1 w-full'");
  });
});
