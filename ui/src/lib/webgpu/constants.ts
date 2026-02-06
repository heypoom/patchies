export const DEFAULT_WGSL_CODE = `// Generate pseudo-random noise from input indices
// Input: array of seed values (or just use for output size)
// Output: array of random f32 values in [0, 1]

@group(0) @binding(0) var<storage, read> seeds: array<f32>;
@group(0) @binding(1) var<storage, read_write> noise: array<f32>;

// Hash function for randomness
fn hash(p: u32) -> f32 {
  var h = p * 747796405u + 2891336453u;
  h = ((h >> 16u) ^ h) * 2246822507u;
  h = ((h >> 16u) ^ h) * 3266489909u;
  return f32(h >> 16u) / 65535.0;
}

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let idx = gid.x;
  if (idx >= arrayLength(&seeds)) { return; }

  // Combine index with seed for variety
  let seed = bitcast<u32>(seeds[idx]);
  noise[idx] = hash(idx + seed);
}`;
