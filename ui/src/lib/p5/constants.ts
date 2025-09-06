import { DEFAULT_OUTPUT_SIZE, PREVIEW_SCALE_FACTOR } from '$lib/canvas/constants';

const defaultWidth = Math.round(DEFAULT_OUTPUT_SIZE[0] / PREVIEW_SCALE_FACTOR);

const defaultHeight = Math.round(DEFAULT_OUTPUT_SIZE[1] / PREVIEW_SCALE_FACTOR);

export const DEFAULT_P5_CODE = `function setup() {
  createCanvas(${defaultWidth}, ${defaultHeight})
  pixelDensity(${PREVIEW_SCALE_FACTOR})
}

function draw() {
  clear()
  fill(255, 255, 100)
  ellipse(${defaultWidth / 2}, ${defaultHeight / 2}, 80, 80)
}`;
