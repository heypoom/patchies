export function measureFps(): Promise<number> {
  return new Promise((resolve) => {
    let counter = 0
    let timer = 0

    const tick = () => {
      counter++
      timer = requestAnimationFrame(tick)
    }

    requestAnimationFrame(tick)

    setTimeout(() => {
      cancelAnimationFrame(timer)
      resolve(counter)
    }, 1000)
  })
}
