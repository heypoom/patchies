const MIX_GL = `void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = fragCoord / iResolution.xy;
  fragColor = mix(
    texture2D(iChannel0, uv),
    texture2D(iChannel1, uv),
    0.5
  );
}`;

export const GLSL_PRESETS: Record<string, { type: string; data: { code: string } }> = {
	'mix.gl': { type: 'glsl', data: { code: MIX_GL.trim() } }
};
