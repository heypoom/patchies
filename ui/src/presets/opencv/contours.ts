const code = `setTitle('opencv contours')
setVideoCount(1)
setPortCount(0, 1)

const cv = await opencv()
const contourColor = new cv.Scalar(255, 32, 180, 255)
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
    const output = new cv.Mat()

    try {
      cv.cvtColor(source, gray, cv.COLOR_RGBA2GRAY)
      cv.Canny(gray, edges, 80, 160)
      cv.findContours(edges, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE)
      source.copyTo(output)

      for (let i = 0; i < contours.size(); i++) {
        cv.drawContours(output, contours, i, contourColor, 2)
      }

      send({
        type: 'rgba',
        data: Float32Array.from(output.data, (value) => value / 255),
        width: frame.width,
        height: frame.height,
        textureFormat: 'rgba8'
      })
    } finally {
      source.delete()
      gray.delete()
      edges.delete()
      contours.delete()
      hierarchy.delete()
      output.delete()
    }

  } finally {
    processing = false
  }
}, { fps: 12 })`;

export const preset = {
  type: 'worker',
  description: 'Draw Canny contours over video. Connect it to float.tex, then glsl> or hydra>.',
  data: { code: code.trim(), showConsole: false, runOnMount: true }
};
