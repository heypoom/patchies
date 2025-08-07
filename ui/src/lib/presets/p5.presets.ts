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

const FLOAT_SLIDER_P5 = `const [MIN, MAX] = [0, 100]
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
  if (v !== prev) send(v/100)
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

export const P5_PRESETS: Record<string, { type: string; data: { code: string } }> = {
	'slider.p5': { type: 'p5', data: { code: SLIDER_P5.trim() } },
	'float-slider.p5': { type: 'p5', data: { code: FLOAT_SLIDER_P5.trim() } },
	'cam.p5': { type: 'p5', data: { code: CAM_P5.trim() } },
	'traffic-light.p5': { type: 'p5', data: { code: TRAFFIC_LIGHT_P5.trim() } }
};
