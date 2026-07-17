import type { RuntimeGraphSpec } from './runtime-object';

export type EditorRuntime = { setGraph(graph: RuntimeGraphSpec): Promise<void> };
