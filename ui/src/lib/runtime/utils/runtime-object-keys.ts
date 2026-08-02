import { hash } from 'ohash';

import { getRawObjectParamsFromExpr } from './runtime-object-data';

import type {
  RuntimeAudioObjectData,
  RuntimeConnectionSpec,
  RuntimeObjectSpec
} from '../types/runtime-object';

export const getRuntimeAudioObjectKey = (
  object: RuntimeObjectSpec<RuntimeAudioObjectData>
): string => hash([object.type, object.data.params]);

export const getRuntimeConnectionId = (connection: RuntimeConnectionSpec): string =>
  hash([connection.source, connection.outlet, connection.target, connection.inlet]);

export const getObjectLifecycleKey = (object: RuntimeObjectSpec): string =>
  hash([object.type, getRawObjectParamsFromExpr(object.data.expr)]);

export const getConnectionKey = (connection: RuntimeConnectionSpec & { id: string }): string =>
  `${connection.id}:${getRuntimeConnectionId(connection)}`;

export const getObjectKey = (object: RuntimeObjectSpec): string => hash([object.type, object.data]);
