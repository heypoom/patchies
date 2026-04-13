const MIX_GL = `// @title Mix
// @primaryButton settings
// @param iMix 0.5 0.0 1.0 "Mix"

uniform sampler2D iChannel0;
uniform sampler2D iChannel1;
uniform float iMix;

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  fragColor = mix(
    texture(iChannel0, uv),
    texture(iChannel1, uv),
    iMix
  );
}`;

const SOLID_GL = `// @title Solid
// @primaryButton settings
// @param iColor color "Color"

uniform vec3 iColor;

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  fragColor = vec4(iColor, 1.0);
}`;

const PASSTHRU_GL = `uniform sampler2D image;

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  fragColor = texture(image, uv);
}`;

const OVERLAY_GL = `uniform sampler2D backdrop;
uniform sampler2D overlay;

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec4 o = texture(overlay, uv);

  fragColor = mix(
    texture(backdrop, uv),
    o,
    o.a
  );
}`;

const AUDIO_FFT_FREQ_GL = `uniform sampler2D freqTexture;

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  float freq = texture(freqTexture, vec2(uv.x/5., uv.y)).r;
  fragColor = vec4(0.1, freq, 1. - freq, 0.9);
}`;

const AUDIO_FFT_WAVEFORM_GL = `uniform sampler2D waveTexture;

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  float wave = texture(waveTexture, vec2(uv.x, uv.y)).r;
  fragColor = vec4(0.1, wave, 1. - wave, 0.9);
}`;

const SWITCHER_GL = `uniform sampler2D a;
uniform sampler2D b;
uniform sampler2D c;
uniform sampler2D d;
uniform sampler2D e;
uniform sampler2D f;
uniform int id;

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec4 o;

  if (id == 0) o = texture(a, uv);
  if (id == 1) o = texture(b, uv);
  if (id == 2) o = texture(c, uv);
  if (id == 3) o = texture(d, uv);
  if (id == 4) o = texture(e, uv);
  if (id == 5) o = texture(f, uv);

  fragColor = o;
}`;

const POSITION_FIELD_GL = `// @title Position Field
// @format rgba32f
// @resolution 256

float hash(vec3 p) {
  p = fract(p * 0.3183099 + vec3(0.1, 0.2, 0.3));
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}

float noise(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(mix(hash(i + vec3(0,0,0)), hash(i + vec3(1,0,0)), f.x),
        mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
    mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x),
        mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y),
    f.z
  );
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  float theta = uv.y * 3.14159265;
  float phi   = uv.x * 6.28318530;

  vec3 p = vec3(
    sin(theta) * cos(phi),
    sin(theta) * sin(phi),
    cos(theta)
  );

  float t = iTime * 0.4;
  float n = noise(p * 2.0 + vec3(0.0, 0.0, t));
  float r = 1.0 + (n - 0.5) * 0.8;

  float swirl = noise(p * 1.2 + vec3(t, 0.0, 0.0)) * 2.0;
  float c = cos(swirl), s = sin(swirl);
  p.xz = mat2(c, -s, s, c) * p.xz;

  fragColor = vec4(p * r, 1.0);
}`;

const TORUS_POSITION_FIELD_GL = `// @title Torus Field
// @format rgba32f
// @resolution 256

// @param radiusMajor 2.0 0.1 5.0 "Torus Major Radius"
// @param radiusMinor 0.6 0.05 2.0 "Torus Minor Radius"
// @param speed 0.5 0.0 2.0 "Rotation Speed"
// @param noiseInfluence 0.3 0.0 2.0 "Noise Warp"
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

export const GLSL_PRESETS: Record<string, { type: string; data: { code: string } }> = {
  'glsl>': { type: 'glsl', data: { code: PASSTHRU_GL.trim() } },
  'mix.gl': { type: 'glsl', data: { code: MIX_GL.trim() } },
  'solid.gl': { type: 'glsl', data: { code: SOLID_GL.trim() } },
  'overlay.gl': { type: 'glsl', data: { code: OVERLAY_GL.trim() } },
  'fft-freq.gl': { type: 'glsl', data: { code: AUDIO_FFT_FREQ_GL.trim() } },
  'fft-waveform.gl': { type: 'glsl', data: { code: AUDIO_FFT_WAVEFORM_GL.trim() } },
  'switcher.gl': { type: 'glsl', data: { code: SWITCHER_GL.trim() } },
  'position-field.gl': { type: 'glsl', data: { code: POSITION_FIELD_GL.trim() } },
  'torus-position-field.gl': { type: 'glsl', data: { code: TORUS_POSITION_FIELD_GL.trim() } }
};
