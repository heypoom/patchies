export type TapCaptureTriggerInput = {
  zeroCrossing: boolean;
  prevSample: number;
  sample: number;
  samplesSinceLastSend: number;
  maxWait: number;
};

export function shouldStartCapture({
  zeroCrossing,
  prevSample,
  sample,
  samplesSinceLastSend,
  maxWait
}: TapCaptureTriggerInput): boolean {
  if (samplesSinceLastSend >= maxWait) return true;
  if (!zeroCrossing) return true;

  return prevSample <= 0 && sample > 0;
}
