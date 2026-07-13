import type { GLSLPreset } from '../types';
import { sourceNotice, commonUv, mathUtils, paletteHelpers } from './shared';

const code = `${sourceNotice}
// @title Paper Gem Smoke
// @primaryButton settings
// @param colorBack color #05030a "Background"
// @param colorInner color #ffffff "Inner"
// @param colorA color #ff4d8d "Smoke A"
// @param colorB color #6be4ff "Smoke B"
// @param colorC color #ffe66d "Smoke C"
// @param colorD color #7856ff "Smoke D"
// @param colorE color #1dd1a1 "Smoke E"
// @param shape 2 (0: Fill, 1: Circle, 2: Daisy, 3: Diamond, 4: Metaballs) "Shape"
// @param innerDistortion 0.55 0.0 1.0 0.001 "Inner Distortion"
// @param outerDistortion 0.45 0.0 1.0 0.001 "Outer Distortion"
// @param innerGlow 0.9 0.0 1.0 0.001 "Inner Glow"
// @param outerGlow 0.55 0.0 1.0 0.001 "Outer Glow"
// @param size 0.55 0.0 1.0 0.001 "Size"
// @param angle 20.0 0.0 360.0 0.1 "Angle"
// @param offset 0.0 -1.0 1.0 0.001 "Offset"
// @noinlet colorBack, colorInner, colorA, colorB, colorC, colorD, colorE, shape, innerDistortion, outerDistortion, innerGlow, outerGlow, size, angle, offset

uniform vec3 colorBack;
uniform vec3 colorInner;
uniform vec3 colorA;
uniform vec3 colorB;
uniform vec3 colorC;
uniform vec3 colorD;
uniform vec3 colorE;
uniform float shape;
uniform float innerDistortion;
uniform float outerDistortion;
uniform float innerGlow;
uniform float outerGlow;
uniform float size;
uniform float angle;
uniform float offset;

${mathUtils}
${commonUv}
${paletteHelpers}

float gemShape(vec2 uv, float t, out float roundness) {
  float edge = 0.0;

  if (shape < 0.5) {
    vec2 box = min(uv + 0.5, 0.5 - uv);

    edge = clamp(1.0 - min(box.x, box.y) * 5.0, 0.0, 1.0);
  } else if (shape < 1.5) {
    edge = pow(clamp(length(uv * 1.45), 0.0, 1.0), 16.0);
  } else if (shape < 2.5) {
    float r = length(uv * 2.1);
    float a = atan(uv.y, uv.x) + 0.2;
    float petals = abs(cos(a * 3.0));

    edge = smoothstep(petals, petals + 0.7, r);
  } else if (shape < 3.5) {
    vec2 p = rotate(uv, 0.25 * PI);
    vec2 m = min(p + 0.5, 0.5 - p);

    edge = clamp(1.0 - min(m.x, m.y) * 4.0, 0.0, 1.0);
  } else {
    float field = 0.0;

    for (int i = 0; i < 5; i++) {
      float fi = float(i);

      vec2 center = 0.34 * vec2(sin(t * (1.0 + fi * 0.25) + fi), cos(t * (0.7 + fi * 0.2) + fi * 2.0));
      float d = length(uv - center);
      field += 0.06 / max(0.001, d * d);
    }

    edge = 1.0 - smoothstep(0.64, 0.88, field);
  }

  roundness = 1.0 - edge;

  return 1.0 - smoothstep(0.88 - 2.0 * fwidth(edge), 0.88, edge);
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = paperObjectUV(fragCoord);

  float t = iTime;
  float roundness;
  float alpha = gemShape(uv, t, roundness);

  vec2 smokeUV = rotate(uv, angle * PI / 180.0) * mix(4.0, 1.0, size);

  vec2 innerUV = smokeUV;
  innerUV.y += innerDistortion * (1.0 - smoothstep(0.0, 1.0, length(0.4 * innerUV)));
  innerUV.y -= 0.4 * innerDistortion;
  innerUV.y += 0.7 * offset * roundness;

  vec2 outerUV = smokeUV;
  outerUV.y += outerDistortion * (1.0 - smoothstep(0.0, 1.0, length(0.4 * outerUV)));
  outerUV.y -= 0.4 * outerDistortion;

  for (int i = 1; i < 5; i++) {
    float fi = float(i);
    innerUV.x += innerDistortion * roundness / fi * cos(t + fi * 2.9 * innerUV.y);
    innerUV.y += innerDistortion * roundness / fi * cos(t + fi * 1.5 * innerUV.x);
    outerUV.x += outerDistortion / fi * cos(t + fi * 2.9 * outerUV.y);
    outerUV.y += outerDistortion / fi * cos(t + fi * 1.5 * outerUV.x);
  }

  float innerSmoke = exp(-1.5 * dot(innerUV, innerUV)) * (0.01 + 0.99 * innerGlow) * alpha;
  float outerSmoke = exp(-1.5 * dot(outerUV, outerUV)) * pow(outerGlow, 2.0) * (1.0 - alpha);
  float smoke = clamp(innerSmoke + outerSmoke, 0.0, 1.0);
  float mixer = smoke * 5.0 + 0.15 * snoise(smokeUV + t * 0.1);

  vec3 smokeColor = paperGradient(fract(mixer * 0.2), colorA, colorB, colorC, colorD, colorE);
  vec3 color = mix(colorBack, smokeColor, smoke);
  color = mix(color, colorInner, alpha * innerGlow * 0.25);

  fragColor = vec4(color, 1.0);
}`;

export const preset: GLSLPreset = {
  type: 'glsl',
  description: 'Procedural Paper Shaders smoky gem glow over selectable shapes.',
  data: { code: code.trim() }
};
