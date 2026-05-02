const MIX_GL = `// @title Mix
// @primaryButton settings
// @param iMix 0.5 0.0 1.0 0.001 "Mix"

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

const LINEAR_RAMP_GL = `// @title Linear Ramp
// @primaryButton settings
// @param angle 0.0 -3.1416 3.1416 0.001 "Angle"
// @param offset 0.0 -1.0 1.0 0.001 "Offset"
// @param colorA color #000000 "Color A"
// @param colorB color #ffffff "Color B"

uniform float angle;
uniform float offset;
uniform vec3 colorA;
uniform vec3 colorB;

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 p = uv - 0.5;
  float c = cos(angle);
  float s = sin(angle);
  float value = dot(p, vec2(c, s)) + 0.5 + offset;

  fragColor = vec4(mix(colorA, colorB, clamp(value, 0.0, 1.0)), 1.0);
}`;

const RADIAL_RAMP_GL = `// @title Radial Ramp
// @primaryButton settings
// @param centerX 0.5 0.0 1.0 0.001 "Center X"
// @param centerY 0.5 0.0 1.0 0.001 "Center Y"
// @param radius 0.5 0.01 1.5 0.001 "Radius"
// @param offset 0.0 -1.0 1.0 0.001 "Offset"
// @param colorA color #000000 "Color A"
// @param colorB color #ffffff "Color B"

uniform float centerX;
uniform float centerY;
uniform float radius;
uniform float offset;
uniform vec3 colorA;
uniform vec3 colorB;

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 center = vec2(centerX, centerY);
  float value = distance(uv, center) / max(radius, 0.001) + offset;

  fragColor = vec4(mix(colorA, colorB, clamp(value, 0.0, 1.0)), 1.0);
}`;

const CIRCULAR_RAMP_GL = `// @title Circular Ramp
// @primaryButton settings
// @param centerX 0.5 0.0 1.0 0.001 "Center X"
// @param centerY 0.5 0.0 1.0 0.001 "Center Y"
// @param angle 0.0 -3.1416 3.1416 0.001 "Angle"
// @param offset 0.0 -1.0 1.0 0.001 "Offset"
// @param colorA color #000000 "Color A"
// @param colorB color #ffffff "Color B"

uniform float centerX;
uniform float centerY;
uniform float angle;
uniform float offset;
uniform vec3 colorA;
uniform vec3 colorB;

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 p = uv - vec2(centerX, centerY);
  float value = atan(p.y, p.x) / 6.28318530718 + 0.5 + angle / 6.28318530718 + offset;
  value = fract(value);

  fragColor = vec4(mix(colorA, colorB, clamp(value, 0.0, 1.0)), 1.0);
}`;

const LEVEL_GL = `// @title Level
// @primaryButton settings
// @param black 0.0 0.0 1.0 0.001 "Black"
// @param white 1.0 0.0 1.0 0.001 "White"
// @param gamma 1.0 0.1 4.0 0.001 "Gamma"
// @param brightness 0.0 -1.0 1.0 0.001 "Brightness"
// @param contrast 1.0 0.0 4.0 0.001 "Contrast"
// @param opacity 1.0 0.0 1.0 0.001 "Opacity"

uniform sampler2D source;
uniform float black;
uniform float white;
uniform float gamma;
uniform float brightness;
uniform float contrast;
uniform float opacity;

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec4 color = texture(source, uv);
  float range = max(white - black, 0.0001);
  color.rgb = clamp((color.rgb - black) / range, 0.0, 1.0);
  color.rgb = pow(color.rgb, vec3(1.0 / max(gamma, 0.0001)));
  color.rgb = (color.rgb - 0.5) * contrast + 0.5 + brightness;
  color.a *= opacity;
  fragColor = color;
}`;

const TRANSFORM_GL = `// @title Transform
// @primaryButton settings
// @param translateX 0.0 -1.0 1.0 0.001 "Translate X"
// @param translateY 0.0 -1.0 1.0 0.001 "Translate Y"
// @param scale 1.0 0.05 4.0 0.001 "Scale"
// @param rotation 0.0 -3.1416 3.1416 0.001 "Rotation"
// @param repeatMode 0 (0: Clamp, 1: Repeat, 2: Mirror) "Repeat Mode"

uniform sampler2D source;
uniform float translateX;
uniform float translateY;
uniform float scale;
uniform float rotation;
uniform float repeatMode;

vec2 mirrorRepeat(vec2 p) {
  vec2 f = fract(p);
  vec2 tile = mod(floor(p), 2.0);
  return mix(f, 1.0 - f, tile);
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 p = uv - 0.5;
  float c = cos(rotation);
  float s = sin(rotation);
  p = mat2(c, -s, s, c) * p;
  p = p / max(scale, 0.0001);
  p += 0.5 - vec2(translateX, translateY);

  vec2 sampleUv = p;
  float alpha = 1.0;
  if (repeatMode > 1.5) {
    sampleUv = mirrorRepeat(p);
  } else if (repeatMode > 0.5) {
    sampleUv = fract(p);
  } else {
    alpha = step(0.0, p.x) * step(0.0, p.y) * step(p.x, 1.0) * step(p.y, 1.0);
  }

  vec4 color = texture(source, sampleUv);
  fragColor = vec4(color.rgb, color.a * alpha);
}`;

const CONSTANT_GL = `// @title Constant
// @primaryButton settings
// @param iColor color "Color"
// @param alpha 1.0 0.0 1.0 0.001 "Alpha"

uniform vec3 iColor;
uniform float alpha;

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  fragColor = vec4(iColor, alpha);
}`;

const PASSTHRU_GL = `uniform sampler2D image;

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  fragColor = texture(image, uv);
}`;

const OVERLAY_GL = `// @title Overlay
// @primaryButton settings
// @param opacity 1.0 0.0 1.0 0.001 "Opacity"

uniform sampler2D background;
uniform sampler2D foreground;
uniform float opacity;

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec4 fg = texture(foreground, uv);
  vec4 bg = texture(background, uv);
  float alpha = fg.a * opacity;

  fragColor = mix(
    bg,
    fg,
    alpha
  );
}`;

const MULTIPLY_GL = `// @title Multiply
// @primaryButton settings
// @param opacity 1.0 0.0 1.0 0.001 "Opacity"

uniform sampler2D a;
uniform sampler2D b;
uniform float opacity;

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec4 ca = texture(a, uv);
  vec4 cb = texture(b, uv);
  vec4 multiplied = vec4(ca.rgb * cb.rgb, ca.a * cb.a);
  fragColor = mix(ca, multiplied, opacity);
}`;

const BLUR_GL = `// @title Blur
// @primaryButton settings
// @param radius 12.0 0.0 80.0 0.001 "Radius"

uniform sampler2D source;
uniform float radius;

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 texel = 1.0 / iResolution.xy;
  vec2 px = texel * radius;
  vec2 diagonal = px * 0.70710678;

  vec4 color = texture(source, uv) * 0.16;
  color += texture(source, uv + vec2(px.x * 0.5, 0.0)) * 0.10;
  color += texture(source, uv - vec2(px.x * 0.5, 0.0)) * 0.10;
  color += texture(source, uv + vec2(0.0, px.y * 0.5)) * 0.10;
  color += texture(source, uv - vec2(0.0, px.y * 0.5)) * 0.10;
  color += texture(source, uv + diagonal) * 0.06;
  color += texture(source, uv - diagonal) * 0.06;
  color += texture(source, uv + vec2(diagonal.x, -diagonal.y)) * 0.06;
  color += texture(source, uv + vec2(-diagonal.x, diagonal.y)) * 0.06;
  color += texture(source, uv + vec2(px.x * 1.5, 0.0)) * 0.05;
  color += texture(source, uv - vec2(px.x * 1.5, 0.0)) * 0.05;
  color += texture(source, uv + vec2(0.0, px.y * 1.5)) * 0.05;
  color += texture(source, uv - vec2(0.0, px.y * 1.5)) * 0.05;

  fragColor = color;
}`;

const CROP_GL = `// @title Crop
// @primaryButton settings
// @param minX 0.0 0.0 1.0 0.001 "Min X"
// @param minY 0.0 0.0 1.0 0.001 "Min Y"
// @param maxX 1.0 0.0 1.0 0.001 "Max X"
// @param maxY 1.0 0.0 1.0 0.001 "Max Y"
// @param feather 0.0 0.0 0.25 0.001 "Feather"

uniform sampler2D source;
uniform float minX;
uniform float minY;
uniform float maxX;
uniform float maxY;
uniform float feather;

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 lo = min(vec2(minX, minY), vec2(maxX, maxY));
  vec2 hi = max(vec2(minX, minY), vec2(maxX, maxY));
  vec2 size = max(hi - lo, vec2(0.0001));
  vec2 sampleUv = (uv - lo) / size;
  vec2 edgeIn = smoothstep(lo, lo + feather, uv);
  vec2 edgeOut = 1.0 - smoothstep(hi - feather, hi, uv);
  float mask = edgeIn.x * edgeIn.y * edgeOut.x * edgeOut.y;
  fragColor = texture(source, sampleUv) * mask;
}`;

const REORDER_GL = `// @title Reorder
// @primaryButton settings
// @param red 0 (0: Red, 1: Green, 2: Blue, 3: Alpha, 4: Luma) "Red Source"
// @param green 1 (0: Red, 1: Green, 2: Blue, 3: Alpha, 4: Luma) "Green Source"
// @param blue 2 (0: Red, 1: Green, 2: Blue, 3: Alpha, 4: Luma) "Blue Source"
// @param alpha 3 (0: Red, 1: Green, 2: Blue, 3: Alpha, 4: Luma) "Alpha Source"
// @param invertAlpha false "Invert Alpha"

uniform sampler2D source;
uniform float red;
uniform float green;
uniform float blue;
uniform float alpha;
uniform bool invertAlpha;

float channel(vec4 color, float source) {
  if (source < 0.5) return color.r;
  if (source < 1.5) return color.g;
  if (source < 2.5) return color.b;
  if (source < 3.5) return color.a;
  return dot(color.rgb, vec3(0.299, 0.587, 0.114));
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec4 color = texture(source, uv);
  float a = channel(color, alpha);
  if (invertAlpha) a = 1.0 - a;
  fragColor = vec4(
    channel(color, red),
    channel(color, green),
    channel(color, blue),
    a
  );
}`;

const DISPLACE_GL = `// @title Displace
// @primaryButton settings
// @param amount 0.05 -0.5 0.5 0.001 "Amount"
// @param center 0.5 0.0 1.0 0.001 "Center"
// @param useLuma false "Use Luma"

uniform sampler2D source;
uniform sampler2D displacement;
uniform float amount;
uniform float center;
uniform bool useLuma;

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec4 disp = texture(displacement, uv);
  vec2 offset = disp.rg - center;
  if (useLuma) {
    float luma = dot(disp.rgb, vec3(0.299, 0.587, 0.114)) - center;
    offset = vec2(luma);
  }
  fragColor = texture(source, uv + offset * amount);
}`;

const EDGE_GL = `// @title Edge
// @primaryButton settings
// @param strength 1.0 0.0 5.0 0.001 "Strength"
// @param threshold 0.05 0.0 1.0 0.001 "Threshold"
// @param monochrome true "Monochrome"

uniform sampler2D source;
uniform float strength;
uniform float threshold;
uniform bool monochrome;

float luma(vec3 color) {
  return dot(color, vec3(0.299, 0.587, 0.114));
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 px = 1.0 / iResolution.xy;
  float tl = luma(texture(source, uv + px * vec2(-1.0,  1.0)).rgb);
  float tc = luma(texture(source, uv + px * vec2( 0.0,  1.0)).rgb);
  float tr = luma(texture(source, uv + px * vec2( 1.0,  1.0)).rgb);
  float ml = luma(texture(source, uv + px * vec2(-1.0,  0.0)).rgb);
  float mr = luma(texture(source, uv + px * vec2( 1.0,  0.0)).rgb);
  float bl = luma(texture(source, uv + px * vec2(-1.0, -1.0)).rgb);
  float bc = luma(texture(source, uv + px * vec2( 0.0, -1.0)).rgb);
  float br = luma(texture(source, uv + px * vec2( 1.0, -1.0)).rgb);

  float gx = -tl - 2.0 * ml - bl + tr + 2.0 * mr + br;
  float gy = -bl - 2.0 * bc - br + tl + 2.0 * tc + tr;
  float edge = smoothstep(threshold, 1.0, length(vec2(gx, gy)) * strength);
  vec4 sourceColor = texture(source, uv);
  fragColor = monochrome
    ? vec4(vec3(edge), sourceColor.a)
    : vec4(sourceColor.rgb * edge, sourceColor.a);
}`;

const NOISE_GL = `// @title Noise
// @primaryButton settings
// @param scale 8.0 0.1 64.0 0.001 "Scale"
// @param speed 0.15 -2.0 2.0 0.001 "Speed"
// @param contrast 1.0 0.1 4.0 0.001 "Contrast"
// @param colorA color #000000 "Color A"
// @param colorB color #ffffff "Color B"

uniform float scale;
uniform float speed;
uniform float contrast;
uniform vec3 colorA;
uniform vec3 colorB;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
    mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x),
    f.y
  );
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  float n = noise(uv * scale + iTime * speed);
  n = clamp((n - 0.5) * contrast + 0.5, 0.0, 1.0);
  fragColor = vec4(mix(colorA, colorB, n), 1.0);
}`;

const NOISE_DISPLACE_GL = `// @title Noise Displace
// @primaryButton settings
// @param scale 8.0 0.1 64.0 0.001 "Scale"
// @param speed 0.15 -2.0 2.0 0.001 "Speed"
// @param amount 0.05 -0.5 0.5 0.001 "Amount"
// @param direction 0.0 0.0 3.1416 0.001 "Direction"

uniform sampler2D source;
uniform float scale;
uniform float speed;
uniform float amount;
uniform float direction;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
    mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x),
    f.y
  );
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 p = uv * scale + iTime * speed;
  vec2 n = vec2(noise(p), noise(p + 13.37)) - 0.5;
  vec2 axis = vec2(cos(direction), sin(direction));
  vec2 offset = mix(n, axis * n.x, 0.5) * amount;
  fragColor = texture(source, uv + offset);
}`;

const FEEDBACK_GL = `// @title Feedback
// @primaryButton settings
// @param feedbackAmount 0.9 0.0 0.999 0.001 "Feedback"
// @param inputAmount 1.0 0.0 1.0 0.001 "Input"
// @param decay 0.98 0.0 1.0 0.001 "Decay"
// @param zoom 1.0 0.8 1.2 0.001 "Zoom"
// @param rotation 0.0 -0.2 0.2 0.0001 "Rotation"

uniform sampler2D source;
uniform sampler2D feedback;
uniform float feedbackAmount;
uniform float inputAmount;
uniform float decay;
uniform float zoom;
uniform float rotation;

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 p = uv - 0.5;
  float c = cos(rotation);
  float s = sin(rotation);
  p = mat2(c, -s, s, c) * p;
  p = p / max(zoom, 0.0001) + 0.5;

  vec4 current = texture(source, uv) * inputAmount;
  vec4 previous = texture(feedback, p) * decay * feedbackAmount;
  fragColor = max(current, previous);
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

const SWITCHER_GL = `// @title Switcher
// @primaryButton settings
// @param id 0 (0: A, 1: B, 2: C, 3: D, 4: E, 5: F) "Input"

uniform sampler2D a;
uniform sampler2D b;
uniform sampler2D c;
uniform sampler2D d;
uniform sampler2D e;
uniform sampler2D f;
uniform float id;

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec4 o;

  if (id < 0.5) o = texture(a, uv);
  if (id >= 0.5 && id < 1.5) o = texture(b, uv);
  if (id >= 1.5 && id < 2.5) o = texture(c, uv);
  if (id >= 2.5 && id < 3.5) o = texture(d, uv);
  if (id >= 3.5 && id < 4.5) o = texture(e, uv);
  if (id >= 4.5) o = texture(f, uv);

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

type GLSLPreset = { type: 'glsl'; description?: string; data: { code: string } };

export const GLSL_PRESETS: Record<string, GLSLPreset> = {
  'glsl>': {
    type: 'glsl',
    description: 'Passthrough shader for processing a video input.',
    data: { code: PASSTHRU_GL.trim() }
  },
  Mix: {
    type: 'glsl',
    description: 'Crossfade between two video inputs.',
    data: { code: MIX_GL.trim() }
  },
  Constant: {
    type: 'glsl',
    description: 'Generate a constant color and alpha.',
    data: { code: CONSTANT_GL.trim() }
  },
  'Linear Ramp': {
    type: 'glsl',
    description: 'Generate a directional linear color ramp.',
    data: { code: LINEAR_RAMP_GL.trim() }
  },
  'Radial Ramp': {
    type: 'glsl',
    description: 'Generate a radial color ramp from a center point.',
    data: { code: RADIAL_RAMP_GL.trim() }
  },
  'Circular Ramp': {
    type: 'glsl',
    description: 'Generate an angular color ramp around a center point.',
    data: { code: CIRCULAR_RAMP_GL.trim() }
  },
  Level: {
    type: 'glsl',
    description: 'Adjust black, white, gamma, brightness, contrast, and opacity.',
    data: { code: LEVEL_GL.trim() }
  },
  Transform: {
    type: 'glsl',
    description: 'Translate, scale, rotate, and tile an input texture.',
    data: { code: TRANSFORM_GL.trim() }
  },
  Overlay: {
    type: 'glsl',
    description: 'Alpha-composite a foreground input over a background input.',
    data: { code: OVERLAY_GL.trim() }
  },
  Multiply: {
    type: 'glsl',
    description: 'Multiply two video inputs with an opacity control.',
    data: { code: MULTIPLY_GL.trim() }
  },
  Blur: {
    type: 'glsl',
    description: 'Apply a practical single-pass 2D blur.',
    data: { code: BLUR_GL.trim() }
  },
  Crop: {
    type: 'glsl',
    description: 'Crop an input texture with optional feathering.',
    data: { code: CROP_GL.trim() }
  },
  Reorder: {
    type: 'glsl',
    description: 'Swizzle color and alpha channels.',
    data: { code: REORDER_GL.trim() }
  },
  Displace: {
    type: 'glsl',
    description: 'Warp an input texture using a displacement texture.',
    data: { code: DISPLACE_GL.trim() }
  },
  Edge: {
    type: 'glsl',
    description: 'Detect image edges with a Sobel-style filter.',
    data: { code: EDGE_GL.trim() }
  },
  Noise: {
    type: 'glsl',
    description: 'Generate animated procedural noise.',
    data: { code: NOISE_GL.trim() }
  },
  'Noise Displace': {
    type: 'glsl',
    description: 'Warp an input texture using animated procedural noise.',
    data: { code: NOISE_DISPLACE_GL.trim() }
  },
  Feedback: {
    type: 'glsl',
    description: 'Accumulate an input with a manually wired feedback inlet.',
    data: { code: FEEDBACK_GL.trim() }
  },
  'fft-freq.gl': {
    type: 'glsl',
    description: 'Visualize FFT frequency data from an audio analysis texture.',
    data: { code: AUDIO_FFT_FREQ_GL.trim() }
  },
  'fft-waveform.gl': {
    type: 'glsl',
    description: 'Visualize waveform data from an audio analysis texture.',
    data: { code: AUDIO_FFT_WAVEFORM_GL.trim() }
  },
  Switcher: {
    type: 'glsl',
    description: 'Select one of six video inputs.',
    data: { code: SWITCHER_GL.trim() }
  },
  'position-field.gl': {
    type: 'glsl',
    description: 'Generate a float position field for GPU geometry workflows.',
    data: { code: POSITION_FIELD_GL.trim() }
  },
  'torus-position-field.gl': {
    type: 'glsl',
    description: 'Generate a float torus position field for GPU geometry workflows.',
    data: { code: TORUS_POSITION_FIELD_GL.trim() }
  }
};
