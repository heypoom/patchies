import { capPreviewSize, DEFAULT_OUTPUT_SIZE, PREVIEW_SCALE_FACTOR } from '$lib/canvas/constants';

const [defaultWidth, defaultHeight] = capPreviewSize(
  Math.round(DEFAULT_OUTPUT_SIZE[0] / PREVIEW_SCALE_FACTOR),
  Math.round(DEFAULT_OUTPUT_SIZE[1] / PREVIEW_SCALE_FACTOR)
);

export const DEFAULT_P5_CODE = `const colors = ['#ff5ea0', '#66ccff', '#a78bfa']

function setup() {
  createCanvas(${defaultWidth}, ${defaultHeight})
  pixelDensity(${PREVIEW_SCALE_FACTOR})
  noStroke()
}

function draw() {
  clear()

  const time = millis() / 1000
  const flowerScale = width / ${DEFAULT_OUTPUT_SIZE[0]}

  Array.from({ length: 9 }, (_, index) => {
    push()
    translate(width / 2, height / 2)
    rotate(time + index * TWO_PI / 9)
    scale(0.65 + sin(time * 3 + index) * 0.35, 1)
    fill(colors[index % colors.length])
    rect(0, -14 * flowerScale, 190 * flowerScale, 28 * flowerScale, 14 * flowerScale)
    pop()
  })
}`;
