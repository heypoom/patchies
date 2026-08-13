export type FluidCanvasResizeAxis = 'horizontal' | 'vertical' | 'both';

export type FluidCanvasOptions = {
  showResizer?: boolean;
  resize?: FluidCanvasResizeAxis;
  keepAspectRatio?: boolean;
  /** Logical canvas pixels, using the same coordinate space as width and height. */
  initialSize?: { width: number; height: number };
};

export type ResolvedFluidCanvasOptions = {
  showResizer: boolean;
  resize: FluidCanvasResizeAxis;
  keepAspectRatio: boolean;
  initialSize?: { width: number; height: number };
};

export function resolveFluidCanvasOptions(
  options: FluidCanvasOptions = {}
): ResolvedFluidCanvasOptions {
  return {
    showResizer: options.showResizer ?? true,
    resize: options.resize ?? 'both',
    keepAspectRatio: options.keepAspectRatio ?? false,
    initialSize: options.initialSize
  };
}
