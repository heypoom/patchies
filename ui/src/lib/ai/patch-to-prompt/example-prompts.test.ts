import { describe, expect, it } from 'vitest';
import { EXAMPLE_PROMPTS, getRandomPrompt } from './example-prompts';

describe('EXAMPLE_PROMPTS', () => {
  it('contains multiple example prompts', () => {
    expect(EXAMPLE_PROMPTS.length).toBeGreaterThan(5);
  });

  it('all prompts are non-empty strings', () => {
    for (const prompt of EXAMPLE_PROMPTS) {
      expect(typeof prompt).toBe('string');
      expect(prompt.length).toBeGreaterThan(0);
    }
  });

  it('contains diverse examples', () => {
    const promptsText = EXAMPLE_PROMPTS.join(' ').toLowerCase();

    // Should have web-related examples
    expect(promptsText).toContain('html');

    // Should have framework examples
    expect(promptsText).toContain('react');

    // Should have vanilla JS option
    expect(promptsText).toContain('vanilla');
  });
});

describe('getRandomPrompt', () => {
  it('returns a string from EXAMPLE_PROMPTS', () => {
    const prompt = getRandomPrompt();

    expect(typeof prompt).toBe('string');
    expect(EXAMPLE_PROMPTS).toContain(prompt);
  });

  it('returns different prompts over multiple calls (statistical)', () => {
    const results = new Set<string>();

    // Call 20 times, should get at least 2 different results
    for (let i = 0; i < 20; i++) {
      results.add(getRandomPrompt());
    }

    expect(results.size).toBeGreaterThan(1);
  });
});
