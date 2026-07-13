import type { GLSLPreset } from '../types';
import { sourceNotice, commonUv, mathUtils } from './shared';

const code = `${sourceNotice}
// @title Paper Spiral
// @primaryButton settings
// @param colorBack color #0f1020 "Background"
// @param colorFront color #f6d365 "Foreground"
// @param density 0.55 0.0 1.0 0.001 "Density"
// @param distortion 0.35 0.0 1.0 0.001 "Distortion"
// @param strokeWidth 0.42 0.01 1.0 0.001 "Stroke Width"
// @param strokeCap 0.2 0.0 1.0 0.001 "Stroke Cap"
// @param strokeTaper 0.4 0.0 1.0 0.001 "Stroke Taper"
// @param noise 0.24 0.0 1.0 0.001 "Noise"
// @param noiseFrequency 0.45 0.0 1.0 0.001 "Noise Frequency"
// @param softness 0.02 0.0 1.0 0.001 "Softness"
// @noinlet colorBack, colorFront, density, distortion, strokeWidth, strokeCap, strokeTaper, noise, noiseFrequency, softness

uniform vec3 colorBack;
uniform vec3 colorFront;
uniform float density;
uniform float distortion;
uniform float strokeWidth;
uniform float strokeCap;
uniform float strokeTaper;
uniform float noise;
uniform float noiseFrequency;
uniform float softness;

${mathUtils}
${commonUv}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = 2.0 * paperPatternUV(fragCoord);
  float t = iTime;
  float l = pow(max(length(uv), 1e-6), clamp(density, 0.0, 1.0));
  float angle = atan(uv.y, uv.x) - t;
  float angleNormalised = angle / TWO_PI;
  angleNormalised += 0.125 * noise * snoise(16.0 * pow(noiseFrequency, 3.0) * uv);

  float offset = l + angleNormalised;
  offset -= distortion * (sin(4.0 * l - 0.5 * t) * cos(PI + l + 0.5 * t));
  float stripe = fract(offset);
  float shape = 2.0 * abs(stripe - 0.5);
  float width = 1.0 - clamp(strokeWidth, 0.005 * strokeTaper, 1.0);

  float cappedWidth = mix(width, (1.0 - stripe) * (1.0 - step(0.5, stripe)), 1.0 - clamp(length(uv), 0.0, 1.0));
  width = mix(width, cappedWidth, strokeCap);
  width *= 1.0 - clamp(strokeTaper, 0.0, 1.0) * length(uv);

  float fw = fwidth(offset);
  float fwMult = 4.0 - 3.0 * (smoothstep(0.05, 0.4, 2.0 * strokeWidth) * smoothstep(0.05, 0.4, 2.0 * (1.0 - strokeWidth)));
  float pixelSize = mix(fwMult * fw, fwidth(shape), clamp(fw, 0.0, 1.0));
  pixelSize = mix(pixelSize, 0.002, strokeCap * (1.0 - clamp(length(uv), 0.0, 1.0)));
  float res = smoothstep(width - pixelSize - softness, width + pixelSize + softness, shape);

  vec3 color = mix(colorBack, colorFront, res);
  color += 1.0 / 256.0 * (fract(sin(dot(0.014 * gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453123) - 0.5);
  fragColor = vec4(color, 1.0);
}`;

export const preset: GLSLPreset = {
  type: 'glsl',
  description: 'Animated Paper Shaders spiral with distortion, taper, and noise controls.',
  data: { code: code.trim() }
};
