const code = `setTitle('opencv color mask')
setVideoCount(1, 1)
setPortCount(0, 0)

const cv = await opencv()
let processing = false

onVideoFrame(async ([frame]) => {
  if (!frame || processing) return

  processing = true

  try {
    const source = cv.matFromImageData(frame)
    const rgb = new cv.Mat()
    const hsv = new cv.Mat()
    const mask = new cv.Mat()
    const output = new cv.Mat()
    const lowerBound = new cv.Mat(frame.height, frame.width, cv.CV_8UC3, [90, 80, 50, 0])
    const upperBound = new cv.Mat(frame.height, frame.width, cv.CV_8UC3, [125, 255, 255, 0])

    try {
      cv.cvtColor(source, rgb, cv.COLOR_RGBA2RGB)
      cv.cvtColor(rgb, hsv, cv.COLOR_RGB2HSV)
      cv.inRange(hsv, lowerBound, upperBound, mask)
      cv.bitwise_and(source, source, output, mask)

      setVideoFrame({
        data: new Uint8ClampedArray(output.data),
        width: frame.width,
        height: frame.height
      })
    } finally {
      source.delete()
      rgb.delete()
      hsv.delete()
      mask.delete()
      output.delete()
      lowerBound.delete()
      upperBound.delete()
    }
  } finally {
    processing = false
  }
}, { fps: 15 })`;

export const preset = {
  type: 'worker',
  description: 'Keep blue hues from video with an HSV mask.',
  data: { code: code.trim(), showConsole: false, runOnMount: true }
};
