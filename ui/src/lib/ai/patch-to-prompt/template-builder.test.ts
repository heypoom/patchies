import { describe, expect, it } from 'vitest';
import {
  buildDirectTemplate,
  estimateTemplateSize,
  isTemplateTooLarge,
  SIZE_THRESHOLD
} from './template-builder';
import type { CleanedPatch } from './patch-transformer';

const createSimplePatch = (): CleanedPatch => ({
  nodes: [
    { id: '1', type: 'slider', data: { min: 0, max: 100, value: 50 } },
    { id: '2', type: 'tone~', data: { waveform: 'sine' } }
  ],
  edges: [{ source: '1', target: '2', targetHandle: 'message-in-0' }],
  metadata: {
    nodeCount: 2,
    edgeCount: 1,
    nodeTypes: ['slider', 'tone~']
  }
});

describe('buildDirectTemplate', () => {
  it('generates template with all sections', () => {
    const patch = createSimplePatch();
    const template = buildDirectTemplate(patch);

    expect(template).toContain('# Patch Implementation Specification');
    expect(template).toContain('## Patch Overview');
    expect(template).toContain('## Data Flow Graph');
    expect(template).toContain('## Node Details');
    expect(template).toContain('## Implementation Notes');
  });

  it('includes patch name in title when provided', () => {
    const patch = createSimplePatch();
    const template = buildDirectTemplate(patch, { patchName: 'My Synth' });

    expect(template).toContain('# My Synth - Implementation Specification');
  });

  it('includes steering prompt in User Requirements section', () => {
    const patch = createSimplePatch();
    const template = buildDirectTemplate(patch, {
      steeringPrompt: 'Simple HTML page with dark theme'
    });

    expect(template).toContain('## User Requirements');
    expect(template).toContain('Simple HTML page with dark theme');
  });

  it('omits User Requirements section when no steering prompt', () => {
    const patch = createSimplePatch();
    const template = buildDirectTemplate(patch);

    expect(template).not.toContain('## User Requirements');
  });

  it('includes node and edge counts in overview', () => {
    const patch = createSimplePatch();
    const template = buildDirectTemplate(patch);

    expect(template).toContain('**2 nodes**');
    expect(template).toContain('**1 connections**');
  });

  it('includes node types in overview', () => {
    const patch = createSimplePatch();
    const template = buildDirectTemplate(patch);

    expect(template).toContain('slider');
    expect(template).toContain('tone~');
  });

  it('includes JSON representation of patch', () => {
    const patch = createSimplePatch();
    const template = buildDirectTemplate(patch);

    expect(template).toContain('```json');
    expect(template).toContain('"nodes"');
    expect(template).toContain('"edges"');
  });

  it('includes implementation hints based on node types', () => {
    const patch = createSimplePatch();
    const template = buildDirectTemplate(patch);

    expect(template).toContain('Web Audio API');
  });

  it('includes node-specific context for each type', () => {
    const patch = createSimplePatch();
    const template = buildDirectTemplate(patch);

    expect(template).toContain('### slider');
    expect(template).toContain('### tone~');
  });

  it('handles empty patch', () => {
    const patch: CleanedPatch = {
      nodes: [],
      edges: [],
      metadata: { nodeCount: 0, edgeCount: 0, nodeTypes: [] }
    };

    const template = buildDirectTemplate(patch);

    expect(template).toContain('# Patch Implementation Specification');
    expect(template).toContain('**0 nodes**');
    expect(template).toContain('**0 connections**');
  });
});

describe('estimateTemplateSize', () => {
  it('returns the character count of the template', () => {
    const patch = createSimplePatch();
    const size = estimateTemplateSize(patch);

    expect(size).toBeGreaterThan(0);
    expect(typeof size).toBe('number');
  });

  it('increases with steering prompt', () => {
    const patch = createSimplePatch();
    const sizeWithout = estimateTemplateSize(patch);
    const sizeWith = estimateTemplateSize(patch, {
      steeringPrompt: 'A very long steering prompt that adds more content'
    });

    expect(sizeWith).toBeGreaterThan(sizeWithout);
  });
});

describe('isTemplateTooLarge', () => {
  it('returns false for small patches', () => {
    const patch = createSimplePatch();
    expect(isTemplateTooLarge(patch)).toBe(false);
  });

  it('uses SIZE_THRESHOLD constant', () => {
    expect(SIZE_THRESHOLD).toBe(50 * 1024); // 50KB
  });
});
