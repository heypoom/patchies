import type { RuntimeConnectionSpec, RuntimeGraphSpec, RuntimeObjectSpec } from './runtime-object';

export type EditorRuntime = {
  setGraph(graph: RuntimeGraphSpec): Promise<void>;
  setObjects(objects: RuntimeObjectSpec[]): Promise<void>;
  setConnections(connections: RuntimeConnectionSpec[]): Promise<void>;
};
