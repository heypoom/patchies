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

export const P5_PRESETS: Record<string, { type: string; data: { code: string } }> = {
	'slider.p5': { type: 'p5', data: { code: SLIDER_P5.trim() } },
	'passthru.p5': { type: 'p5', data: { code: PASSTHRU_P5.trim() } },
	'cam.p5': { type: 'p5', data: { code: CAM_P5.trim() } }
};
