const code = `setTitle('opencv motion')
setVideoCount(1, 1)
setPortCount(0, 0)

const cv = await opencv()
let processing = false
let previous = null

onVideoFrame(async ([frame]) => {
  if (!frame || processing) return

  processing = true

  try {
    const source = cv.matFromImageData(frame)
    const gray = new cv.Mat()
    const difference = new cv.Mat()
    const output = new cv.Mat()

    try {
      cv.cvtColor(source, gray, cv.COLOR_RGBA2GRAY)

      if (!previous || previous.rows !== gray.rows || previous.cols !== gray.cols) {
        previous?.delete()
        previous = gray.clone()
        return
      }

      cv.absdiff(gray, previous, difference)
      cv.threshold(difference, difference, 24, 255, cv.THRESH_BINARY)
      cv.cvtColor(difference, output, cv.COLOR_GRAY2RGBA)
      gray.copyTo(previous)

      setVideoFrame({
        data: new Uint8ClampedArray(output.data),
        width: frame.width,
        height: frame.height
      })
    } finally {
      source.delete()
      gray.delete()
      difference.delete()
      output.delete()
    }
  } finally {
    processing = false
  }
}, { fps: 15 })`;

export const preset = {
  type: 'worker',
  description: 'Show areas that changed between video frames with OpenCV.',
  data: { code: code.trim(), showConsole: false, runOnMount: true }
};
