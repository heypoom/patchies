const NOISE_SPHERE_SHADERPARK = `let scale = 2.0;
let s = getSpace();
let n = 0.1 * noise(scale * s + time);
sphere(0.7 + n);`;

type ShaderParkPresetData = {
  code: string;
  title?: string;
  messageInletCount?: number;
  messageOutletCount?: number;
  videoInletCount?: number;
  videoOutletCount?: number;
};

export const SHADERPARK_PRESETS: Record<
  string,
  { type: 'shaderpark'; description: string; data: ShaderParkPresetData }
> = {
  'Noise Sphere': {
    type: 'shaderpark',
    description: 'A soft white SDF sphere with subtle animated noise displacement',
    data: {
      title: 'Noise Sphere',
      code: NOISE_SPHERE_SHADERPARK,
      messageInletCount: 1,
      messageOutletCount: 0,
      videoInletCount: 0,
      videoOutletCount: 1
    }
  }
};
