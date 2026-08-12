import { describe, expect, it, vi } from 'vitest';

import {
  installRenderWorkerRuntimeOnce,
  type RenderWorkerInstallScope
} from './renderWorkerInstallOnce';

describe('installRenderWorkerRuntimeOnce', () => {
  it('installs one runtime for repeated evaluations of the same worker global', () => {
    const scope: RenderWorkerInstallScope = {};
    const install = vi.fn();

    expect(installRenderWorkerRuntimeOnce(scope, install)).toBe(true);
    expect(installRenderWorkerRuntimeOnce(scope, install)).toBe(false);
    expect(install).toHaveBeenCalledTimes(1);
  });

  it('allows startup to be retried after installation fails', () => {
    const scope: RenderWorkerInstallScope = {};
    const error = new Error('startup failed');

    const install = vi.fn().mockImplementationOnce(() => {
      throw error;
    });

    expect(() => installRenderWorkerRuntimeOnce(scope, install)).toThrow(error);
    expect(installRenderWorkerRuntimeOnce(scope, install)).toBe(true);
    expect(install).toHaveBeenCalledTimes(2);
  });
});
