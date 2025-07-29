const SLIDER_P5 = `const W = 200
const H = 50
const X_OFFSET = 10
let slider
let prev = 0

function setup() {
  createCanvas(W, H);
  noDrag()
  slider = createSlider(0, 255);
  slider.position(X_OFFSET, (H/2)-X_OFFSET);
  slider.size(W - (X_OFFSET*2));
}

function draw() {
  const v = slider.value()
  if (v !== prev) send(v)
  prev = v
}`;

const PASSTHRU_P5 = `function setup() {
  createCanvas(200, 200)
}

function draw() {
  drawSource()
}`;

const CAM_P5 = `let video;

function setup() {
  createCanvas(640/2, 480/2);
  video = createCapture(VIDEO);
  video.size(640/2, 480/2);
  video.hide();
}

function draw() {
  image(video, 0, 0, width, height);
}`;

const TRAFFIC_LIGHT_P5 = `const OFF = '#95a5a6'
const W = 80
const states = ['red', 'yellow', 'green']

let state = 'red'

onMessage(m => {
  if (m.data === 'next' || m.data?.type === 'bang') {
    state = states[(states.indexOf(state) + 1) % states.length]
    send(state)
  } else if (states.includes(m.data)) {
    state = m.data
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
	'passthru.p5': { type: 'p5', data: { code: PASSTHRU_P5.trim() } },
	'cam.p5': { type: 'p5', data: { code: CAM_P5.trim() } },
	'traffic_light.p5': { type: 'p5', data: { code: TRAFFIC_LIGHT_P5.trim() } }
};
