const SLIDER_P5 = `const [MIN, MAX] = [0, 100]
const [W, H, XO] = [200, 50, 10]
let slider
let prev = 0

function setup() {
  createCanvas(W, H);
  noDrag()
  slider = createSlider(MIN, MAX);
  slider.position(XO, (H/2)-XO);
  slider.size(W - (XO*2));
}

function draw() {
  const v = slider.value()
  if (v !== prev) send(v)
  prev = v
}`;

const CAM_P5 = `let video;

function setup() {
  createCanvas(200, 150);
  video = createCapture(VIDEO);
  video.size(640, 480);
  video.hide();
  pixelDensity(3)
}

function draw() {
  image(video, 0, 0, width, height);
}`;

const TRAFFIC_LIGHT_P5 = `const OFF = '#95a5a6'
const W = 80
const states = ['red', 'yellow', 'green']

let state = 'red'

onMessage(m => {
  if (m === 'next' || m?.type === 'bang') {
    state = states[(states.indexOf(state) + 1) % states.length]
    send(state)
  } else if (states.includes(m)) {
    state = m
    send(state)
  }
})

function setup() {
  createCanvas(W, 200)
  pixelDensity(3)
  noStroke()
}

function draw() {  
  fill(state === 'red' ? '#e74c3c' : OFF)
  ellipse(W/2+5, 40, 50, 50)

  fill(state === 'yellow' ? '#f1c40f' : OFF)
  ellipse(W/2+5, 100, 50, 50)

  fill(state === 'green' ? '#2ecc71' : OFF)
  ellipse(W/2+5, 160, 50, 50)
}`;

const AUDIO_FFT_P5 = `function setup() {
  createCanvas(200, 150)
  pixelDensity(4)
  strokeWeight(3)
}

function draw() {
  clear()
  noStroke();
  
  const waveform = fft()
  const spectrum = fft({type: 'frequency'})
  if (!waveform || !spectrum) return
  
  const sl = spectrum.length / 5
  for (let i = 0; i< sl; i++){
    let x = map(i, 0, sl, 0, width);
    let h = map(spectrum[i], 0, 250, height, 0) - height;
    fill(255, spectrum[i], 100);
    rect(x, height, width / sl, h)
  }

  noFill();
  beginShape();
  stroke('white');
  for (let i = 0; i < waveform.length; i++){
    let x = map(i, 0, waveform.length, 0, width);
    let y = map( waveform[i], 0, 256, 0, height);
    vertex(x,y);
  }
  endShape();
}`;

export const P5_PRESETS: Record<string, { type: string; data: { code: string } }> = {
	'slider.p5': { type: 'p5', data: { code: SLIDER_P5.trim() } },
	'cam.p5': { type: 'p5', data: { code: CAM_P5.trim() } },
	'traffic-light.p5': { type: 'p5', data: { code: TRAFFIC_LIGHT_P5.trim() } },
	'audio-fft.p5': { type: 'p5', data: { code: AUDIO_FFT_P5.trim() } }
};
