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

export const P5_PRESETS: Record<string, { type: string; data: { code: string } }> = {
	'slider.p5': { type: 'p5', data: { code: SLIDER_P5.trim() } },
	'passthru.p5': { type: 'p5', data: { code: PASSTHRU_P5.trim() } }
};
