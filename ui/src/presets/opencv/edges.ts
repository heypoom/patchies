const code = `setTitle('opencv edges')
setVideoCount(1, 1)
setPortCount(0, 0)

const cv = await opencv()
let processing = false

onVideoFrame(async ([frame]) => {
  if (!frame || processing) return

  processing = true

  try {
    const source = cv.matFromImageData(frame)
    const gray = new cv.Mat()
    const edges = new cv.Mat()
    const output = new cv.Mat()

    try {
      cv.cvtColor(source, gray, cv.COLOR_RGBA2GRAY)
      cv.Canny(gray, edges, 80, 160)
      cv.cvtColor(edges, output, cv.COLOR_GRAY2RGBA)

      setVideoFrame({
        data: new Uint8ClampedArray(output.data),
        width: frame.width,
        height: frame.height
      })
    } finally {
      source.delete()
      gray.delete()
      edges.delete()
      output.delete()
    }
  } finally {
    processing = false
  }
}, { fps: 15 })`;

export const preset = {
  type: 'worker',
  description: 'Turn video into a Canny edge output with OpenCV.',
  data: { code: code.trim(), showConsole: false, runOnMount: true }
};
