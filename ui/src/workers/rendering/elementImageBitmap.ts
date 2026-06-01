import type { ElementImageLike } from '$lib/html-in-canvas/html-canvas-video-output';

type ElementImageContext2D = OffscreenCanvasRenderingContext2D & {
  drawElementImage?: (
    elementImage: ElementImageLike,
    dx: number,
    dy: number,
    dw: number,
    dh: number
  ) => DOMMatrix;
};

export function renderElementImageToBitmap(
  elementImage: ElementImageLike,
  width: number,
  height: number
): ImageBitmap | null {
  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext('2d') as ElementImageContext2D | null;

  try {
    if (!ctx || typeof ctx.drawElementImage !== 'function') {
      return null;
    }

    ctx.clearRect(0, 0, width, height);
    ctx.drawElementImage(elementImage, 0, 0, width, height);

    return canvas.transferToImageBitmap();
  } finally {
    elementImage.close();
  }
}
