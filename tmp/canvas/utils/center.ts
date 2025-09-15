type Pos = { x: number; y: number }

function getRandomOffset(min: number, max: number) {
  return Math.random() * (max - min) + min
}

function getPositionWithRandomOffset(
  centerX: number,
  centerY: number,
  offsetXRange: number,
  offsetYRange: number,
): Pos {
  // Generate random offsets within the specified ranges
  const xOffset = getRandomOffset(-offsetXRange, offsetXRange)
  const yOffset = getRandomOffset(-offsetYRange, offsetYRange)

  // Calculate the final position by adding the offsets to the center point
  const x = centerX + xOffset
  const y = centerY + yOffset

  return { x, y }
}

export function getCenterWithOffset(): Pos {
  // Get the dimensions of the viewport
  const viewportWidth =
    window.innerWidth || document.documentElement.clientWidth
  const viewportHeight =
    window.innerHeight || document.documentElement.clientHeight

  // Calculate the center point of the viewport
  const centerX = viewportWidth / 2
  const centerY = viewportHeight / 2

  // Define the range for random offsets
  const offsetXRange = 50 // Adjust this value as needed
  const offsetYRange = 50 // Adjust this value as needed

  // Get the position with random offset
  return getPositionWithRandomOffset(
    centerX,
    centerY,
    offsetXRange,
    offsetYRange,
  )
}
