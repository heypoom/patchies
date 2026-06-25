export function calculateRms(samples: Float32Array): number {
  if (samples.length === 0) return 0;

  let sum = 0;

  for (let i = 0; i < samples.length; i++) {
    sum += samples[i] * samples[i];
  }

  return Math.sqrt(sum / samples.length);
}
