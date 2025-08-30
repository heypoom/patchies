export const WEBGL_EXTENSIONS = ['OES_texture_float_linear'];

export const PREVIEW_SCALE_FACTOR = 4;

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

export const DEFAULT_STRUDEL_CODE = `setcpm(60)

n("<0 -3>, 2 4 <[6,8] [7,9]>")
.scale("<C:major D:mixolydian>/4")
.sound("piano")`;

export const DEFAULT_AI_IMAGE_PROMPT = `a sleepy little town in the mountains, masterpiece, realistic, high quality, 4k`;

export const DEFAULT_BUTTERCHURN_PRESET = '$$$ Royal - Mashup (431)';

export const DEFAULT_JS_CANVAS_CODE = `ctx.fillStyle = '#18181b'
ctx.fillRect(0, 0, width, height)

function draw() {
  ctx.clearRect(0, 0, width, height)
  ctx.fillStyle = '#18181b'
  ctx.fillRect(0, 0, width, height)

  const time = Date.now() * 0.004
  const x = width/2 + Math.cos(time) * 60
  const y = height/2 + Math.sin(time) * 50

  ctx.fillStyle = '#4ade80'
  ctx.beginPath()
  ctx.arc(x, y, 20, 0, Math.PI * 2)
  ctx.fill()

  requestAnimationFrame(draw)
}

draw()`;

export const DEFAULT_SWISSGL_CODE = `function render({t}) {
  glsl({
    t,
    Mesh: [10, 10],
    VP: \`XY*0.8+sin(t+XY.yx*2.0)*0.2,0,1\`,
    FP: \`UV,0.5,1\`,
  })
}`;

export const DEFAULT_PYTHON_CODE = `import numpy as np

np.arange(15).reshape(3, 5)`;
