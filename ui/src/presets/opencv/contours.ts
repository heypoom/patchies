const code = `setTitle('opencv contours')
setVideoCount(1)
setPortCount(0, 1)

const cv = await opencv()
let processing = false

onVideoFrame(async ([frame]) => {
  if (!frame || processing) return

  processing = true

  try {
    const source = cv.matFromImageData(frame)
    const gray = new cv.Mat()
    const edges = new cv.Mat()
    const contours = new cv.MatVector()
    const hierarchy = new cv.Mat()

    try {
      cv.cvtColor(source, gray, cv.COLOR_RGBA2GRAY)
      cv.Canny(gray, edges, 80, 160)
      cv.findContours(edges, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE)

      const bounds = []
      for (let i = 0; i < contours.size(); i++) {
        const contour = contours.get(i)
        try {
          bounds.push(cv.boundingRect(contour))
        } finally {
          contour.delete()
        }
      }

      send({ type: 'contours', width: frame.width, height: frame.height, bounds })
    } finally {
      source.delete()
      gray.delete()
      edges.delete()
      contours.delete()
      hierarchy.delete()
    }

  } finally {
    processing = false
  }
}, { fps: 12 })`;

export const preset = {
  type: 'worker',
  description: 'Find Canny edge contours in a connected video frame and emit their bounding boxes.',
  data: { code: code.trim(), showConsole: false, runOnMount: true }
};
