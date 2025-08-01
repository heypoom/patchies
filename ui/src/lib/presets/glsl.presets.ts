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

const PASSTHRU_GL = `uniform sampler2D iChannel0;

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  fragColor = texture(iChannel0, fragCoord / iResolution.xy);
}`;

export const GLSL_PRESETS: Record<string, { type: string; data: { code: string } }> = {
	'mix.gl': { type: 'glsl', data: { code: MIX_GL.trim() } },
	'passthru.gl': { type: 'glsl', data: { code: PASSTHRU_GL.trim() } }
};
