import type regl from 'regl';

export type OutputTextureSource = {
  texture: regl.Texture2D;
  width: number;
  height: number;
};

/**
 * Draws a resolved render texture onto the worker's final output canvas.
 **/
export const drawToFinalOutput = ({
  regl,
  drawFinalOutput,
  source,
  outputSize,
  backgroundSize
}: {
  regl: regl.Regl;
  drawFinalOutput: regl.DrawCommand;
  source: OutputTextureSource;
  outputSize: [number, number];
  backgroundSize: [number, number];
}): void => {
  const [outputWidth, outputHeight] = outputSize;
  const [backgroundWidth, backgroundHeight] = backgroundSize;

  const { texture, width: sourceWidth, height: sourceHeight } = source;

  const sourceAspect = sourceWidth / sourceHeight;
  const backgroundAspect = backgroundWidth / backgroundHeight;

  let sourceX0 = 0;
  let sourceY0 = 0;
  let sourceX1 = sourceWidth;
  let sourceY1 = sourceHeight;

  if (sourceAspect > backgroundAspect) {
    const cropWidth = sourceHeight * backgroundAspect;
    const offset = (sourceWidth - cropWidth) / 2;

    sourceX0 = Math.floor(offset);
    sourceX1 = Math.floor(offset + cropWidth);
  } else if (sourceAspect < backgroundAspect) {
    const cropHeight = sourceWidth / backgroundAspect;
    const offset = (sourceHeight - cropHeight) / 2;

    sourceY0 = Math.floor(offset);
    sourceY1 = Math.floor(offset + cropHeight);
  }

  const gl = regl._gl as WebGL2RenderingContext;
  gl.viewport(0, 0, outputWidth, outputHeight);

  drawFinalOutput({
    texture,
    sourceUvRect: [
      sourceX0 / sourceWidth,
      sourceY0 / sourceHeight,
      sourceX1 / sourceWidth,
      sourceY1 / sourceHeight
    ]
  });

  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
};
