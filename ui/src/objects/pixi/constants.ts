export const DEFAULT_PIXI_CODE = `const { Graphics } = PIXI
const colors = [0xff5ea0, 0x66ccff, 0xa78bfa]

const petals = Array.from({ length: 9 }, (_, index) => {
  const petal = new Graphics()
    .roundRect(0, -14, 190, 28, 14)
    .fill(colors[index % colors.length])

  petal.position.set(width / 2, height / 2)
  stage.addChild(petal)

  return petal
})

function draw(t) {
  petals.forEach((petal, index) => {
    petal.rotation = t + index * Math.PI * 2 / petals.length
    petal.scale.x = 0.65 + Math.sin(t * 3 + index) * 0.35
  })
}`;

export const DEFAULT_PIXI_DOM_CODE = `const { Graphics } = PIXI
const colors = [0xff5ea0, 0x66ccff, 0xa78bfa]

const petals = Array.from({ length: 9 }, (_, index) => {
  const petal = new Graphics()
    .roundRect(0, -14, 190, 28, 14)
    .fill(colors[index % colors.length])

  petal.position.set(width / 2, height / 2)
  petal.eventMode = 'static'
  petal.cursor = 'pointer'
  petal.on('pointertap', () => petal.tint = Math.random() * 0xffffff)

  stage.addChild(petal)

  return petal
})

function draw(time) {
  petals.forEach((petal, index) => {
    petal.rotation = time + index * Math.PI * 2 / petals.length
  })
}`;
