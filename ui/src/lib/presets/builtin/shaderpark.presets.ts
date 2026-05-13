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

displace(mouse.x, mouse.y, 0.0);
sphere(0.22 + 0.08 * sin(time * 2.0));

shine(0.8);
metal(0.15);`;

type ShaderParkPresetData = {
  code: string;
  title?: string;
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
  }
};
