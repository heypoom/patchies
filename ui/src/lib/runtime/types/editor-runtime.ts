import type { RuntimeObjectSpec } from './runtime-object';

export type EditorRuntime = { reconcileObjects(objects: RuntimeObjectSpec[]): Promise<void> };
