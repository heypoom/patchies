const code = `setTitle('opencv threshold')
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
    const binary = new cv.Mat()
    const output = new cv.Mat()

    try {
      cv.cvtColor(source, gray, cv.COLOR_RGBA2GRAY)
      cv.threshold(gray, binary, 128, 255, cv.THRESH_BINARY)
      cv.cvtColor(binary, output, cv.COLOR_GRAY2RGBA)

      send({
        type: 'rgba',
        data: new Uint8ClampedArray(output.data),
        width: frame.width,
        height: frame.height
      })
    } finally {
      source.delete()
      gray.delete()
      binary.delete()
      output.delete()
    }

  } finally {
    processing = false
  }
}, { fps: 12 })`;

export const preset = {
  type: 'worker',
  description: 'Convert a connected video frame to a black-and-white RGBA message with OpenCV.',
  data: { code: code.trim(), showConsole: false, runOnMount: true }
};
