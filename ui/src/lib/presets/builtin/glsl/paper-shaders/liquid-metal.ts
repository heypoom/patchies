import type { GLSLPreset } from '../types';
import { sourceNotice, commonUv, mathUtils } from './shared';

const code = `${sourceNotice}
// @title Paper Liquid Metal
// @primaryButton settings
// @param colorBack color #08080b "Background"
// @param colorTint color #d8e8ff "Tint"
// @param shape 2 (0: Fill, 1: Circle, 2: Daisy, 3: Diamond, 4: Metaballs) "Shape"
// @param repetition 4.0 1.0 10.0 0.001 "Repetition"
// @param softness 0.28 0.0 1.0 0.001 "Softness"
// @param distortion 0.45 0.0 1.0 0.001 "Distortion"
// @param contour 0.7 0.0 1.0 0.001 "Contour"
// @param angle 20.0 0.0 360.0 0.1 "Angle"
// @param shiftRed 0.3 -1.0 1.0 0.001 "Red Shift"
// @param shiftBlue 0.4 -1.0 1.0 0.001 "Blue Shift"
// @noinlet colorBack, colorTint, shape, repetition, softness, distortion, contour, angle, shiftRed, shiftBlue

uniform vec3 colorBack;
uniform vec3 colorTint;
uniform float shape;
uniform float repetition;
uniform float softness;
uniform float distortion;
uniform float contour;
uniform float angle;
uniform float shiftRed;
uniform float shiftBlue;

${mathUtils}
${commonUv}

float liquidShape(vec2 uv, float t, out float edge) {
  float mask = 1.0;
  edge = 0.0;

  if (shape < 0.5) {
    vec2 box = abs(uv) / max(0.5, max(iResolution.x, iResolution.y) / min(iResolution.x, iResolution.y));
    edge = pow(clamp(max(box.x, box.y) * 1.8, 0.0, 1.0), 5.0);
    mask = 1.0;
  } else if (shape < 1.5) {
    float d = length(uv * 1.45);
    edge = pow(clamp(d, 0.0, 1.0), 14.0);
    mask = 1.0 - smoothstep(0.68, 0.7, d);
  } else if (shape < 2.5) {
    float r = length(uv * 2.1);
    float a = atan(uv.y, uv.x);
    float petals = 0.56 + 0.18 * cos(6.0 * a + 0.8 * sin(t));
    edge = smoothstep(petals - 0.16, petals + 0.16, r);
    mask = 1.0 - smoothstep(petals, petals + 0.035, r);
  } else if (shape < 3.5) {
    vec2 p = rotate(uv, 0.25 * PI);
    float d = max(abs(p.x), abs(p.y)) * 2.1;
    edge = pow(clamp(d, 0.0, 1.0), 8.0);
    mask = 1.0 - smoothstep(0.88, 0.91, d);
  } else {
    float field = 0.0;
    for (int i = 0; i < 5; i++) {
      float fi = float(i);
      float speed = 1.0 + 0.4 * fi;
      vec2 center = 0.35 * vec2(sin(t * speed + fi * 1.7), cos(t * (speed * 0.7) + fi * 2.1));
      float d = length(uv - center);
      field += 0.065 / max(0.001, d * d);
    }
    mask = smoothstep(0.72, 0.82, field);
    edge = 1.0 - smoothstep(0.68, 0.92, field);
  }

  return clamp(mask, 0.0, 1.0);
}

float stripeChannel(float direction, float offset, float bump, float blur) {
  float stripe = fract(direction + offset);
  float thinA = smoothstep(0.0, blur, stripe) * (1.0 - smoothstep(0.12, 0.12 + blur, stripe));
  float thinB = smoothstep(0.22, 0.22 + blur, stripe) * (1.0 - smoothstep(0.3, 0.3 + blur, stripe));
  float grad = smoothstep(0.32, 1.0, stripe);
  return mix(0.05, 1.0, max(max(thinA, thinB), grad * (0.55 + 0.45 * bump)));
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = paperObjectUV(fragCoord);
  float t = 0.3 * (iTime + 2.8);
  float edge;
  float mask = liquidShape(uv, t, edge);
  vec2 p = uv + 0.08 * distortion * vec2(snoise(uv * 3.0 + t), snoise(uv * 3.0 - t));
  p = rotate(p, (-angle + 70.0) * PI / 180.0);
  float bump = pow(max(0.0, 1.0 - length(uv * vec2(1.0, 1.35))), 1.4);
  float direction = (p.x - p.y + 0.55 * edge * contour) * repetition - t;
  direction += distortion * snoise(uv * 4.0 - t) * (0.35 + contour * edge);
  float blur = 0.01 + 0.08 * softness + 0.12 * contour * edge;
  vec3 metal = vec3(
    stripeChannel(direction, shiftRed * 0.08, bump, blur),
    stripeChannel(direction, 0.0, bump, blur),
    stripeChannel(direction, -shiftBlue * 0.08, bump, blur)
  );
  metal = mix(metal, metal * colorTint, 0.5);
  metal *= 0.55 + 0.45 * bump;
  float glow = exp(-10.0 * abs(edge - 0.7)) * contour;
  vec3 color = mix(colorBack, metal + glow * colorTint * 0.35, mask);
  fragColor = vec4(color, 1.0);
}`;

export const preset: GLSLPreset = {
  type: 'glsl',
  description: 'Procedural Paper Shaders liquid-metal material over selectable shapes.',
  data: { code: code.trim() }
};
