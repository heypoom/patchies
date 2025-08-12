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

const OVERLAY_GL = `uniform sampler2D iChannel0;
uniform sampler2D iChannel1;

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = fragCoord / iResolution.xy;
  vec4 t = texture(iChannel0, uv);
  vec4 u = texture(iChannel1, uv);

  fragColor = mix(
    t,
    u,
    u.a
  );
}
`;

const AUDIO_FFT_GL = `uniform sampler2D fftTexture;

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = fragCoord / iResolution.xy;
  float freq = texture(fftTexture, vec2(uv.x, uv.y)).r;
  fragColor = vec4(freq, 0.2, 1.0 - freq, 1.0);
}`;

export const GLSL_PRESETS: Record<string, { type: string; data: { code: string } }> = {
	'red.gl': { type: 'glsl', data: { code: RED_GL.trim() } },
	'mix.gl': { type: 'glsl', data: { code: MIX_GL.trim() } },
	'mix-value.gl': { type: 'glsl', data: { code: MIX_V_GL.trim() } },
	'passthru.gl': { type: 'glsl', data: { code: PASSTHRU_GL.trim() } },
	'overlay.gl': { type: 'glsl', data: { code: OVERLAY_GL.trim() } },
	'audio-fft.gl': { type: 'glsl', data: { code: AUDIO_FFT_GL.trim() } }
};
