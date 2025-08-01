export const WEBGL_EXTENSIONS = ['OES_texture_float_linear'];

export const DEFAULT_GLSL_CODE = `// uniforms: iResolution, iTime, iMouse
// you can define your own uniforms!

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = fragCoord / iResolution.xy;
    vec3 color = vec3(0.0);
    float time = iTime * 0.5;
    
    color.r = sin(uv.x * 10.0 + time) * 0.5 + 0.5;
    color.g = sin(uv.y * 10.0 + time * 1.2) * 0.5 + 0.5;
    color.b = sin((uv.x + uv.y) * 5.0 + time * 0.8) * 0.5 + 0.5;
    
    float brightness = sin(time * 2.0) * 0.2 + 0.8;
    color *= brightness;
    fragColor = vec4(color, 1.0);
}`;

export const DEFAULT_JS_CODE = `console.log(1 + 1)`;

export const DEFAULT_STRUDEL_CODE = `note("c a f e").jux(rev)`;

export const DEFAULT_AI_IMAGE_PROMPT = `a sleepy little town in the mountains, masterpiece, realistic, high quality, 4k`;

export const DEFAULT_BUTTERCHURN_PRESET = '$$$ Royal - Mashup (431)';
