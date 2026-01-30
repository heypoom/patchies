const MIX_GL = `uniform sampler2D iChannel0;
uniform sampler2D iChannel1;

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  fragColor = mix(
    texture(iChannel0, uv),
    texture(iChannel1, uv),
    0.5
  );
}`;

const RED_GL = `void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  fragColor = vec4(1.0, 0.0, 0.0, 1.0);
}
`;

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

export const GLSL_PRESETS: Record<string, { type: string; data: { code: string } }> = {
  'red.gl': { type: 'glsl', data: { code: RED_GL.trim() } },
  'mix.gl': { type: 'glsl', data: { code: MIX_GL.trim() } },
  'passthru.gl': { type: 'glsl', data: { code: PASSTHRU_GL.trim() } },
  'pipe.gl': { type: 'glsl', data: { code: PASSTHRU_GL.trim() } },
  'overlay.gl': { type: 'glsl', data: { code: OVERLAY_GL.trim() } },
  'fft-freq.gl': { type: 'glsl', data: { code: AUDIO_FFT_FREQ_GL.trim() } },
  'fft-waveform.gl': { type: 'glsl', data: { code: AUDIO_FFT_WAVEFORM_GL.trim() } },
  'switcher.gl': { type: 'glsl', data: { code: SWITCHER_GL.trim() } }
};
