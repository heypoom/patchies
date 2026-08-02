import type { ObjectInlet, ObjectOutlet } from '$lib/objects';

export interface RuntimeObjectSpec<TData = Record<string, unknown>> {
  id: string;
  type: string;
  data: TData;
}

export interface RuntimeConnectionSpec {
  id?: string;

  source: string;
  outlet?: string;

  target: string;
  inlet?: string;
}

export interface RuntimeGraphSpec {
  objects: RuntimeObjectSpec[];
  connections?: RuntimeConnectionSpec[];
}

export interface RuntimeObjectPorts {
  inlets: ObjectInlet[];
  outlets: ObjectOutlet[];
  hasDynamicOutlets: boolean;
}

export type RuntimeObjectViewRevisionListener = (nodeId: string) => void;

export type RuntimeAudioObjectData = {
  params: unknown[];
} & Record<string, unknown>;
