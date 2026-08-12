import { installRenderWorkerRuntime } from './renderWorker';

import {
  installRenderWorkerRuntimeOnce,
  type RenderWorkerInstallScope
} from './renderWorkerInstallOnce';

// Keep this facade in the top-level-await dependency graph. The production
// transformer then waits for the neutral render-core chunk before installation.
await Promise.resolve();

installRenderWorkerRuntimeOnce(self as RenderWorkerInstallScope, installRenderWorkerRuntime);
