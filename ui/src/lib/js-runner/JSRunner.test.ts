import { afterEach, describe, expect, it, vi } from 'vitest';

import { JSRunner } from './JSRunner';

describe('JSRunner', () => {
  const runner = new JSRunner();
  const nodeId = 'js-runner-tags-test';

  afterEach(() => {
    runner.destroy(nodeId);
  });

  it('exposes setTags to user code', async () => {
    const setTags = vi.fn();

    await runner.executeJavaScript(nodeId, "setTags(['shader/foo/function'])", {
      skipMessageContext: true,
      setTags
    });

    expect(setTags).toHaveBeenCalledWith(['shader/foo/function']);
  });
});
