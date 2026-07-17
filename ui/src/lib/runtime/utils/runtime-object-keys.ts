import { hash } from 'ohash';

import type { RuntimeAudioObjectDescriptor } from '../types/audio-adapter';

import type {
  RuntimeConnectionSpec,
  RuntimeObjectDescriptor,
  RuntimeObjectSpec
} from '../types/runtime-object';

export const getRuntimeObjectDescriptorKey = (descriptor: RuntimeObjectDescriptor): string =>
  hash([descriptor.objectType, descriptor.data, descriptor.rawParams]);

export const getRuntimeAudioObjectDescriptorKey = (
  descriptor: RuntimeAudioObjectDescriptor
): string => hash([descriptor.objectType, descriptor.params]);

export const getRuntimeConnectionId = (connection: RuntimeConnectionSpec): string =>
  hash([connection.source, connection.outlet, connection.target, connection.inlet]);

export const getObjectLifecycleKey = (descriptor: RuntimeObjectDescriptor): string =>
  hash([descriptor.objectType, descriptor.rawParams]);

export const getConnectionKey = (connection: RuntimeConnectionSpec & { id: string }): string =>
  `${connection.id}:${getRuntimeConnectionId(connection)}`;

export const getObjectKey = (object: RuntimeObjectSpec): string => hash([object.type, object.data]);
