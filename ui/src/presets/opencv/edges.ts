const code = `setTitle('opencv edges')
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
    const output = new cv.Mat()

    try {
      cv.cvtColor(source, gray, cv.COLOR_RGBA2GRAY)
      cv.Canny(gray, edges, 80, 160)
      cv.cvtColor(edges, output, cv.COLOR_GRAY2RGBA)

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
      output.delete()
    }
  } finally {
    processing = false
  }
}, { fps: 15 })`;

export const preset = {
  type: 'worker',
  description:
    'Turn video into a Canny edge texture. Connect it to float.tex, then glsl> or hydra>.',
  data: { code: code.trim(), showConsole: false, runOnMount: true }
};
