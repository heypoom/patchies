export const WEBGL_EXTENSIONS = ['OES_texture_float_linear'];

export const DEFAULT_OUTPUT_SIZE = [1008, 654] as [width: number, height: number];
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

export const DEFAULT_AI_IMAGE_PROMPT = `little rainicorn, high quality, 16:9 aspect ratio`;

export const DEFAULT_BUTTERCHURN_PRESET = '$$$ Royal - Mashup (431)';

export const DEFAULT_JS_CANVAS_CODE = `function draw() {
  ctx.clearRect(0, 0, width, height)

  const time = Date.now() * 0.004
  const x = width/2 + Math.cos(time) * 60
  const y = height/2 + Math.sin(time) * 50

  ctx.fillStyle = 'white'
  ctx.beginPath()
  ctx.arc(x, y, 80, 0, Math.PI * 2)
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

export const DEFAULT_CHUCK_CODE = `SinOsc s => JCRev r => dac;

.2 => s.gain;
.1 => r.mix;

[ 0, 2, 4, 7, 9, 11 ] @=> int hi[];

while (true) {
  Std.mtof(
    45 + Std.rand2(0, 3) * 12 +
    hi[Std.rand2(0, hi.cap() - 1)]
  ) => s.freq;

  120::ms => now;
}`;

export const DEFAULT_DSP_JS_CODE = `function process(inputs, outputs) {
  outputs[0].forEach((channel) => {
    for (let i = 0; i < channel.length; i++) {
      let t = (currentFrame + i) / sampleRate
      channel[i] = Math.sin(t * 440 * Math.PI * 2)
    }
  })
}`;

export const DEFAULT_TONE_JS_CODE = `setPortCount(1)

const synth = new Tone.Oscillator(440, 'sine').start()
synth.connect(outputNode)

recv(m => {
  synth.frequency.value = m;
})

return { cleanup: () => synth.dispose() }
`;

export const DEFAULT_ELEM_CODE = `setPortCount(1)

let [rate, setRate] = core.createRef("const", {
  value: 440
}, []);

recv(freq => setRate({ value: freq }))

core.render(el.cycle(rate), el.cycle(rate))`;

export const DEFAULT_SONIC_CODE = `setPortCount(1)

// Load a synth definition
await sonic.loadSynthDef('sonic-pi-prophet')

// Trigger synth when receiving messages
recv(note => {
  // Play a note (middle C by default)
  sonic.send('/s_new', 'sonic-pi-prophet', -1, 0, 0, 'note', note || 60)
})

// Trigger on mount
sonic.send('/s_new', 'sonic-pi-prophet', -1, 0, 0, 'note', 60)`;

export const DEFAULT_CSOUND_CODE = `instr 1
  ioct = octcps(p4)
  kpwm = oscili(.1, 5)
  asig = vco2(p5, p4, 4, .5 + kpwm)
  asig += vco2(p5, p4 * 2)

  idepth = 3
  acut = transegr:a(0, .002, 0, idepth, .5, -4.2, 0.001, .5, -4.2, 0)
  asig = zdf_2pole(asig, cpsoct(ioct + acut), 0.5)

  asig *= linsegr:a(1, p3, 1, .5, 0)

  out(asig, asig)
endin

instr Main
  inotes[] fillarray 60, 67, 63, 65, 62
  ioct[] fillarray 0,1,0,0,1
  inote = inotes[p4 % 37 % 11 % 5] + 12 * ioct[p4 % 41 % 17 % 5]
  schedule(1, 0, .25, cpsmidinn(inote), 0.25)

  if (p4 % 64 % 37 % 17 % 11 == 0 && inote != 74 && inote != 62) then
    schedule(1, 0, .5, cpsmidinn(inote + 7), 0.125)
  endif

  schedule(p1, .25, .25, p4 + 1)
endin

schedule("Main", 0, 0, 0)`;
