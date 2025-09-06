const MIX_GL = `uniform sampler2D iChannel0;
uniform sampler2D iChannel1;

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = fragCoord / iResolution.xy;
  fragColor = mix(
    texture(iChannel0, uv),
    texture(iChannel1, uv),
    0.5
  );
}`;

const RED_GL = `void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = fragCoord / iResolution.xy;
  fragColor = vec4(1.0, 0.0, 0.0, 1.0);
}
`;

const MIX_V_GL = `uniform sampler2D iChannel0;
uniform sampler2D iChannel1;
uniform float iMix;

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = fragCoord / iResolution.xy;
  fragColor = mix(
    texture(iChannel0, uv),
    texture(iChannel1, uv),
    iMix
  );
}`;

const PASSTHRU_GL = `uniform sampler2D iChannel0;

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  fragColor = texture(iChannel0, fragCoord / iResolution.xy);
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
  vec2 uv = fragCoord / iResolution.xy;
  float freq = texture(freqTexture, vec2(uv.x/5., uv.y)).r;
  fragColor = vec4(0.1, freq, 1. - freq, 0.9);
}`;

const AUDIO_FFT_WAVEFORM_GL = `uniform sampler2D waveTexture;

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = fragCoord / iResolution.xy;
  float wave = texture(waveTexture, vec2(uv.x, uv.y)).r;
  fragColor = vec4(0.1, wave, 1. - wave, 0.9);
}`;

export const GLSL_PRESETS: Record<string, { type: string; data: { code: string } }> = {
	'red.gl': { type: 'glsl', data: { code: RED_GL.trim() } },
	'mix.gl': { type: 'glsl', data: { code: MIX_GL.trim() } },
	'mix-value.gl': { type: 'glsl', data: { code: MIX_V_GL.trim() } },
	'passthru.gl': { type: 'glsl', data: { code: PASSTHRU_GL.trim() } },
	'null.gl': { type: 'glsl', data: { code: PASSTHRU_GL.trim() } },
	'overlay.gl': { type: 'glsl', data: { code: OVERLAY_GL.trim() } },
	'fft-freq.gl': { type: 'glsl', data: { code: AUDIO_FFT_FREQ_GL.trim() } },
	'fft-waveform.gl': { type: 'glsl', data: { code: AUDIO_FFT_WAVEFORM_GL.trim() } }
};
