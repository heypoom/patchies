import { hash } from 'ohash';

import type { RuntimeAudioObjectDescriptor } from '../types/audio-adapter';
import type { RuntimeObjectDescriptor } from '../types/runtime-object';

export const getRuntimeObjectDescriptorKey = (descriptor: RuntimeObjectDescriptor): string =>
  hash([descriptor.objectType, descriptor.data, descriptor.rawParams]);

export const getRuntimeAudioObjectDescriptorKey = (
  descriptor: RuntimeAudioObjectDescriptor
): string => hash([descriptor.objectType, descriptor.params]);
