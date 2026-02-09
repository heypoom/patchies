import { describe, expect, it, beforeEach, vi } from 'vitest';
import { hasGeminiApiKey, refineSpec } from './spec-refiner';
import type { CleanedPatch } from './patch-transformer';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    }
  };
})();

Object.defineProperty(globalThis, 'localStorage', {
  value: localStorageMock
});

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

describe('hasGeminiApiKey', () => {
  beforeEach(() => {
    localStorageMock.clear();
  });

  it('returns false when no API key is set', () => {
    expect(hasGeminiApiKey()).toBe(false);
  });

  it('returns true when API key is set', () => {
    localStorageMock.setItem('gemini-api-key', 'AIzaTest123');
    expect(hasGeminiApiKey()).toBe(true);
  });

  it('returns false for empty string API key', () => {
    localStorageMock.setItem('gemini-api-key', '');
    expect(hasGeminiApiKey()).toBe(false);
  });
});

describe('refineSpec', () => {
  beforeEach(() => {
    localStorageMock.clear();
  });

  it('throws when no API key is set', async () => {
    const patch = createSimplePatch();

    await expect(refineSpec(patch)).rejects.toThrow(
      'Gemini API key is not set. Please set it in the settings.'
    );
  });

  it('throws when aborted before starting', async () => {
    localStorageMock.setItem('gemini-api-key', 'AIzaTest123');

    const controller = new AbortController();
    controller.abort();

    const patch = createSimplePatch();

    await expect(refineSpec(patch, { signal: controller.signal })).rejects.toThrow(
      'Request cancelled'
    );
  });

  it('accepts options for patchName and steeringPrompt', async () => {
    localStorageMock.setItem('gemini-api-key', 'AIzaTest123');

    // Mock the GoogleGenAI import
    vi.mock('@google/genai', () => ({
      GoogleGenAI: vi.fn().mockImplementation(() => ({
        models: {
          generateContent: vi.fn().mockResolvedValue({
            text: 'Mocked refined specification'
          })
        }
      }))
    }));

    const patch = createSimplePatch();

    // This will use the mocked API
    const result = await refineSpec(patch, {
      patchName: 'Test Patch',
      steeringPrompt: 'Make it beautiful'
    });

    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });
});
