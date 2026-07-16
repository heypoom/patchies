import type { MessageContext } from '$lib/messages/MessageContext';
import type { TextObjectClass, TextObjectV2 } from '$lib/objects/v2/interfaces/text-objects';
import type { ObjectInlet, ObjectOutlet } from '$lib/objects/v2/object-metadata';

export type RuntimeObjectDescriptor = {
  id: string;
  objectType: string;
  data: Record<string, unknown>;
  rawParams: string[];
};

export type RuntimeObjectSpec<TData = Record<string, unknown>> = {
  id: string;
  type: string;
  data: TData;
};

export type RuntimeConnectionSpec = {
  id?: string;
  source: string;
  outlet?: string;
  target: string;
  inlet?: string;
};

export type RuntimeGraphSpec = {
  objects: RuntimeObjectSpec[];
  connections?: RuntimeConnectionSpec[];
};

export type RuntimeObjectService = {
  createObject(
    nodeId: string,
    objectType: string,
    messageContext: MessageContext,
    data?: Record<string, unknown>,
    rawParams?: string[]
  ): Promise<TextObjectV2 | null>;

  isObjectInRegistry(objectType: string): boolean;
  getObjectClass(objectType: string): TextObjectClass | undefined;
  getObjectById(nodeId: string): TextObjectV2 | null;
  removeObjectById(nodeId: string): void;
};

export type RuntimeObjectPorts = {
  inlets: ObjectInlet[];
  outlets: ObjectOutlet[];
  hasDynamicOutlets: boolean;
};

export type RuntimeObjectViewRevisionListener = (nodeId: string) => void;
