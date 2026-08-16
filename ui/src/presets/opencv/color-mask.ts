const code = `setTitle('opencv color mask')
setVideoCount(1)
setPortCount(0, 1)

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

    try {
      cv.cvtColor(source, rgb, cv.COLOR_RGBA2RGB)
      cv.cvtColor(rgb, hsv, cv.COLOR_RGB2HSV)
      cv.inRange(hsv, new cv.Scalar(90, 80, 50), new cv.Scalar(125, 255, 255), mask)
      cv.bitwise_and(source, source, output, mask)

      send({
        type: 'rgba',
        data: Float32Array.from(output.data, (value) => value / 255),
        width: frame.width,
        height: frame.height,
        textureFormat: 'rgba8'
      })
    } finally {
      source.delete()
      rgb.delete()
      hsv.delete()
      mask.delete()
      output.delete()
    }
  } finally {
    processing = false
  }
}, { fps: 15 })`;

export const preset = {
  type: 'worker',
  description:
    'Keep blue hues from video with an HSV mask. Connect it to float.tex, then glsl> or hydra>.',
  data: { code: code.trim(), showConsole: false, runOnMount: true }
};
