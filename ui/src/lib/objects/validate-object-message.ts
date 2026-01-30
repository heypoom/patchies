import { match, P } from 'ts-pattern';
import { isScheduledMessage } from '$lib/audio/time-scheduling-types';

import { ALWAYS_VALID } from './parse-object-param';

import type { ObjectInlet, ObjectDataType } from './v2/object-metadata';

// Helper function to validate inlet/outlet types
export const validateMessageToObject = (value: unknown, inlet: ObjectInlet): boolean => {
  if (!inlet.type) return true;

  // Signals and schedulable inlets can be scheduled.
  if ((inlet.type === 'signal' || inlet.isAudioParam) && isScheduledMessage(value)) return true;

  // Use custom validators.
  if (inlet.validator) return inlet.validator(value);

  const isTypeValid = match<[unknown, ObjectDataType]>([value, inlet.type])
    .with([P.any, P.union(...ALWAYS_VALID)], () => true)
    .with([{ type: 'bang' }, 'bang'], () => true)
    .with([P.number, 'float'], () => true)
    .with([P.number, 'int'], ([n]) => Number.isInteger(n))
    .with([P.string, 'string'], () => true)
    .with([P.boolean, 'bool'], () => true)
    .with([P.array(P.number), 'int[]'], ([arr]) => arr.every(Number.isInteger))
    .with([P.array(P.number), 'float[]'], () => true)
    .with(
      [
        P.union(P.instanceOf(Float16Array), P.instanceOf(Float32Array), P.instanceOf(Float64Array)),
        'float[]'
      ],
      () => true
    )
    .otherwise(() => false);

  if (!isTypeValid) return false;

  // Message contains an invalid option
  if (inlet.options && !inlet.options.includes(value)) return false;

  // Message contains a number that is out of range
  if (typeof value === 'number') {
    const isNumberTooHigh = inlet.minNumber !== undefined && value < inlet.minNumber;
    const isNumberTooLow = inlet.maxNumber !== undefined && value > inlet.maxNumber;
    if (isNumberTooLow || isNumberTooHigh) return false;
  }

  return true;
};
