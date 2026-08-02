import { AudioRegistry } from '$lib/registry/AudioRegistry';

import {
  getAudioParamsFromData,
  getRawObjectParamsFromExpr,
  getRuntimeObjectParamsFromData,
  getTextObjectData,
  isObjectBoxData
} from '../utils/runtime-object-data';

import type { RuntimeAudioObjectDescriptor } from '../types/audio-adapter';
import type { RuntimeObjectSpec } from '../types/runtime-object';

type RuntimeObjectResolverOptions = {
  isMessageObject: (objectType: string) => boolean;
  isAudioObject: (objectType: string) => boolean;
};

export type ResolvedRuntimeObject =
  | { kind: 'message'; object: RuntimeObjectSpec }
  | { kind: 'audio'; descriptor: RuntimeAudioObjectDescriptor }
  | { kind: 'ignored' };

export class RuntimeObjectResolver {
  constructor(private options: RuntimeObjectResolverOptions) {}

  resolve(object: RuntimeObjectSpec): ResolvedRuntimeObject {
    const audioDescriptor = this.getAudioObjectDescriptor(object);
    if (audioDescriptor) return { kind: 'audio', descriptor: audioDescriptor };

    const messageObject = this.getMessageObjectSpec(object);
    if (messageObject) return { kind: 'message', object: messageObject };

    return { kind: 'ignored' };
  }

  private getMessageObjectSpec(object: RuntimeObjectSpec): RuntimeObjectSpec | null {
    if (!this.options.isMessageObject(object.type)) return null;

    const data = object.data;
    const rawParams = getRawObjectParamsFromExpr(data.expr);

    const runtimeData = isObjectBoxData(object.type, data)
      ? getTextObjectData(object.type, data, rawParams)
      : { ...data };

    return { ...object, data: runtimeData };
  }

  private getAudioObjectDescriptor(object: RuntimeObjectSpec): RuntimeAudioObjectDescriptor | null {
    if (!this.options.isAudioObject(object.type)) return null;

    if (isObjectBoxData(object.type, object.data)) {
      return {
        id: object.id,
        objectType: object.type,
        params: getRuntimeObjectParamsFromData(object.type, object.data)
      };
    }

    const nodeClass = AudioRegistry.getInstance().get(object.type);
    if (!nodeClass?.runtimeManaged) return null;

    const params = getAudioParamsFromData(
      nodeClass.inlets ?? [],
      nodeClass.hasRuntimeData ? undefined : object.data
    );

    return {
      id: object.id,
      objectType: object.type,
      params,

      ...(nodeClass.hasRuntimeData && { runtimeData: object.data })
    };
  }
}
