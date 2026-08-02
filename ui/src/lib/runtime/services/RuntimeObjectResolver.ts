import type { AudioNodeClass } from '$lib/audio';
import { AudioRegistry } from '$lib/registry/AudioRegistry';

import {
  isObjectBoxData,
  getTextObjectData,
  getAudioParamsFromData,
  getRawObjectParamsFromExpr,
  getRuntimeObjectParamsFromData
} from '../utils/runtime-object-data';

import type { RuntimeAudioObjectData, RuntimeObjectSpec } from '../types/runtime-object';

type RuntimeObjectResolverOptions = {
  isMessageObject: (objectType: string) => boolean;
  isAudioObject: (objectType: string) => boolean;
};

export type ResolvedRuntimeObject =
  | { kind: 'message'; object: RuntimeObjectSpec }
  | { kind: 'audio'; object: RuntimeObjectSpec<RuntimeAudioObjectData> }
  | { kind: 'ignored' };

export class RuntimeObjectResolver {
  constructor(private options: RuntimeObjectResolverOptions) {}

  resolve(object: RuntimeObjectSpec): ResolvedRuntimeObject {
    const audioObject = this.getAudioObjectSpec(object);
    if (audioObject) return { kind: 'audio', object: audioObject };

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

  private getAudioObjectSpec(
    object: RuntimeObjectSpec
  ): RuntimeObjectSpec<RuntimeAudioObjectData> | null {
    if (!this.options.isAudioObject(object.type)) return null;

    if (isObjectBoxData(object.type, object.data)) {
      return {
        ...object,
        data: { params: getRuntimeObjectParamsFromData(object.type, object.data) }
      };
    }

    const nodeClass = AudioRegistry.getInstance().get(object.type);
    if (!nodeClass?.runtimeManaged) return null;

    const params = getAudioObjectParams(object, nodeClass);

    return { ...object, data: { ...object.data, params } };
  }
}

function getAudioObjectParams(object: RuntimeObjectSpec, nodeClass: AudioNodeClass) {
  if (Array.isArray(object.data.params)) {
    return object.data.params;
  }

  return getAudioParamsFromData(
    nodeClass.inlets ?? [],
    nodeClass.hasRuntimeData ? undefined : object.data
  );
}
