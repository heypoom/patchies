export type PreviewDimensions = {
  width: number;
  height: number;
};

export const getLivePreviewContainScale = (
  preview: PreviewDimensions,
  viewport: PreviewDimensions
): number => Math.min(viewport.width / preview.width, viewport.height / preview.height);
