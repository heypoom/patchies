export interface RenderWorkerInstallScope {
  __patchiesRenderWorkerRuntimeInstalled__?: boolean;
}

/**
 * Install the stateful render runtime at most once per worker global.
 *
 * The flag is set before installation so a new module
 * evaluation cannot create a second renderer. Failed installation
 * clears it so startup can be retried.
 */
export function installRenderWorkerRuntimeOnce(
  scope: RenderWorkerInstallScope,
  install: () => void
): boolean {
  if (scope.__patchiesRenderWorkerRuntimeInstalled__) return false;

  scope.__patchiesRenderWorkerRuntimeInstalled__ = true;

  try {
    install();
    return true;
  } catch (error) {
    delete scope.__patchiesRenderWorkerRuntimeInstalled__;
    throw error;
  }
}
