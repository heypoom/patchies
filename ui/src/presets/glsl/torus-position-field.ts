import type { GLSLPreset } from './types';

const code = `// @title Torus Field
// @format rgba32f
// @resolution 256

// @param radiusMajor 2.0 0.1 5.0 0.001 "Torus Major Radius"
// @param radiusMinor 0.6 0.05 2.0 0.001 "Torus Minor Radius"
// @param speed 0.5 0.0 2.0 0.001 "Rotation Speed"
// @param noiseInfluence 0.3 0.0 2.0 0.001 "Noise Warp"
// @primaryButton settings

#include <lygia/generative/snoise>

uniform float radiusMajor;
uniform float radiusMinor;
uniform float speed;
uniform float noiseInfluence;

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    // Normalized coordinates (0 to 1)
    // For a single torus, we map the entire UV domain to the torus surface
    vec2 uv = fragCoord / iResolution.xy;

    // Parametric Torus angles spanning the whole UV space
    float u = uv.x * 6.28318530718; // Angle around the ring
    float v = uv.y * 6.28318530718; // Angle around the tube

    float t = iTime * speed;

    // Base Torus Position Logic
    // x = (R + r*cos(v)) * cos(u)
    // y = (R + r*cos(v)) * sin(u)
    // z = r * sin(v)

    float distToCenter = radiusMajor + radiusMinor * cos(v);
    vec3 p;
    p.x = distToCenter * cos(u);
    p.y = distToCenter * sin(u);
    p.z = radiusMinor * sin(v);

    // Rotation based on time
    float rotAngle = t;

    float c1 = cos(rotAngle), s1 = sin(rotAngle);
    p.xz *= mat2(c1, -s1, s1, c1);

    float c2 = cos(rotAngle * 0.7), s2 = sin(rotAngle * 0.7);
    p.xy *= mat2(c2, -s2, s2, c2);

    // Add some noise distortion to the position
    // Using the position itself as a seed for the noise
    float noise = snoise(vec3(p * 0.5 + t));
    p += normalize(p) * noise * noiseInfluence;

    // Store position in RGB, Alpha as active state
    fragColor = vec4(p, 1.0);
}`;

export const preset: GLSLPreset = {
  type: 'glsl',
  description: 'Generate a float torus position field for GPU geometry workflows.',
  data: { code: code.trim() }
};
