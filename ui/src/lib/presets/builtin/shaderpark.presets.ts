import type { ShaderParkRenderMode } from '$lib/rendering/types';

const NOISE_SPHERE_SHADERPARK = `// @title Noise Sphere
// @primaryButton settings

let radius = input(0.7, 0.1, 1.2);
let scale = input(2.0, 0.0, 10.0);
let s = getSpace();
let n = 0.1 * noise(scale * s + time);
sphere(radius + n);`;

const SQUARE_SYMMETRY_SHADERPARK = `// https://shaderpark.com/sculpture/-OsK9Xs40PPK4VdLRyrp
// by https://shaderpark.com/user/jsqvlC
// @title Square Symmetry
// @primaryButton settings

let s = getSpace();

let sizeBase = input(0.5, 0.1, 1.2);
let sizeAmp = input(0.2, 0, 0.6);
let spacing = input(0.22, 0.05, 0.5);
let strength = input(5, 0, 12);
let drift = input2D(0, 0);

const lineCount = 6.0;

s.x += drift.x * 0.2;
s.y += drift.y * 0.2;

const sz = sizeBase + nsin(time) * sizeAmp;

const complexDiv = (a, b) => {
  const dm = 1.0 / (b.x * b.x + b.y * b.y);

  return dm * vec2(
    a.x * b.x + a.y * b.y,
    a.y * b.x - a.x * b.y
  );
};

function palette(t, a, b, c, d) {
  return a + b * cos(c * t + d);
}

let phi = 0.0;

for (let i = 0.0; i < lineCount; i += 1.0) {
  const xoff = (i - (lineCount - 1.0) * 0.5) * spacing;
  const a = vec2(s.x - xoff, s.y - sz);
  const b = vec2(s.x - xoff, s.y + sz);
  const q = complexDiv(a, b);

  phi += strength * atan(q.y, q.x) + 0.35 * i * sin(time * 0.9);
}

for (let i = 0.0; i < lineCount; i += 1.0) {
  const yoff = (i - (lineCount - 1.0) * 0.5) * spacing;
  const a = vec2(s.y - yoff, s.x - sz);
  const b = vec2(s.y - yoff, s.x + sz);
  const q = complexDiv(a, b);

  phi += strength * atan(q.y, q.x) + 0.35 * i * sin(time * 0.9);
}

phi = phi / (lineCount * 2.0);

const angle = sin(time * 0.84) * phi + 3.0 * sin(time);

const v = palette(
  angle,
  vec3(1, 0.1, 0.3),
  vec3(0.46, 0.22, 0.35),
  vec3(0.82, 0.84, 0.65),
  vec3(0.53, 0.23, 0.22)
);

color(v);
box(vec3(5.0, 2.0, 0.01));`;

const MOUSE_FOLLOWER_SHADERPARK = `// @title Mouse Follower

let s = getSpace();

let cursor = vec2(mouse.x, mouse.y);
let d = length(vec2(s.x, s.y) - cursor);

color(vec3(
  0.2 + 0.8 * nsin(time + mouse.x * 3.0),
  0.3 + 0.7 * nsin(time * 0.7 + mouse.y * 4.0),
  1.0 - smoothstep(0.0, 0.8, d)
));

shine(0.8);
metal(0.15);
displace(mouse.x, mouse.y, 0.0);
sphere(0.22 + 0.08 * sin(time * 2.0));`;

const OCTAHEDRON_SDF_SHADERPARK = `// @title Octahedron SDF
// https://iquilezles.org/articles/distfunctions/

let octahedron = glslSDF(\`
  float sdOctahedron(vec3 p, float s) {
    vec3 q;
    p = abs(p);

    float m = p.x + p.y + p.z - s;

    if (3.0 * p.x < m) {
      q = p.xyz;
    } else if (3.0 * p.y < m) {
      q = p.yzx;
    } else if (3.0 * p.z < m) {
      q = p.zxy;
    } else {
      return m * 0.57735027;
    }

    float k = clamp(0.5 * (q.z - q.y + s), 0.0, s);

    return length(vec3(q.x, q.y - s + k, q.z - k));
  }
\`);

shine(nsin(time))
metal(nsin(time))

let ray = getRayDirection()
color(ray.z, ray.x, ray.y)

octahedron(.6);`;

type ShaderParkPresetData = {
  code: string;
  title?: string;
  renderMode?: ShaderParkRenderMode;
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
      videoInletCount: 0,
      videoOutletCount: 1
    }
  },
  'Square Symmetry': {
    type: 'shaderpark',
    description: 'A richly colored line-field sculpture with generated input controls',
    data: {
      title: 'Square Symmetry',
      code: SQUARE_SYMMETRY_SHADERPARK,
      videoInletCount: 0,
      videoOutletCount: 1
    }
  },
  'Mouse Follower': {
    type: 'shaderpark',
    description: 'A mouse-reactive sphere for testing Shader Park mouse input',
    data: {
      title: 'Mouse Follower',
      code: MOUSE_FOLLOWER_SHADERPARK,
      videoInletCount: 0,
      videoOutletCount: 1
    }
  },
  'Octahedron SDF': {
    type: 'shaderpark',
    description: 'An octahedron SDF made with Shader Park glslSDF',
    data: {
      title: 'Octahedron SDF',
      code: OCTAHEDRON_SDF_SHADERPARK,
      renderMode: '3d',
      videoInletCount: 0,
      videoOutletCount: 1
    }
  }
};
