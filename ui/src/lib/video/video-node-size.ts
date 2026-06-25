export interface VideoNodeDisplaySizeInput {
  nodeWidth: number | undefined;
  nodeHeight: number | undefined;
  videoWidth: number;
  videoHeight: number;
  previewWidth: number;
  previewHeight: number;
}

export interface VideoNodeDisplaySize {
  width: number;
  height: number;
}

export function getVideoNodeDisplaySize({
  nodeWidth,
  nodeHeight,
  videoWidth,
  videoHeight,
  previewWidth,
  previewHeight
}: VideoNodeDisplaySizeInput): VideoNodeDisplaySize {
  if (isPositiveFinite(nodeWidth) && isPositiveFinite(nodeHeight)) {
    return {
      width: Math.round(nodeWidth),
      height: Math.round(nodeHeight)
    };
  }

  const aspectRatio = videoWidth / videoHeight;
  let width = previewWidth;
  let height = previewWidth / aspectRatio;

  if (height > previewHeight) {
    height = previewHeight;
    width = previewHeight * aspectRatio;
  }

  return {
    width: Math.round(width),
    height: Math.round(height)
  };
}

function isPositiveFinite(value: number | undefined): value is number {
  return Number.isFinite(value) && value !== undefined && value > 0;
}
