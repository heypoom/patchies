const VIDEO_CUBE_THREE = `const { Scene, PerspectiveCamera, BoxGeometry, Mesh, MeshBasicMaterial } = THREE

setVideoCount(1, 1)

const scene = new Scene()
const camera = new PerspectiveCamera(75, width / height, 0.1, 1000)
camera.position.z = 2

const geometry = new BoxGeometry(1, 1, 1)
const material = new MeshBasicMaterial({ color: 0xffffff })
const cube = new Mesh(geometry, material)
scene.add(cube)

function draw(t) {
  const tex = getTexture(0)
  if (tex) {
    material.map = tex
    material.needsUpdate = true
  }
  cube.rotation.x += 0.01
  cube.rotation.y += 0.01
  renderer.render(scene, camera)
}`;

const VIDEO_TORUS_THREE = `const { Scene, PerspectiveCamera, TorusKnotGeometry, Mesh, MeshBasicMaterial } = THREE

setVideoCount(1, 1)

const scene = new Scene()
const camera = new PerspectiveCamera(75, width / height, 0.1, 1000)
camera.position.z = 2.5

const geometry = new TorusKnotGeometry(0.8, 0.25, 150, 20)
const material = new MeshBasicMaterial({ color: 0xffffff })
const shape = new Mesh(geometry, material)
scene.add(shape)

function draw(t) {
  const tex = getTexture(0)
  if (tex) {
    material.map = tex
    material.needsUpdate = true
  }
  shape.rotation.x += 0.01
  shape.rotation.y += 0.015
  renderer.render(scene, camera)
}`;

const VIDEO_SPHERE_THREE = `const { Scene, PerspectiveCamera, SphereGeometry, Mesh, MeshBasicMaterial } = THREE

setVideoCount(1, 1)

const scene = new Scene()
const camera = new PerspectiveCamera(60, width / height, 0.1, 1000)
camera.position.set(0, 0.8, 2)
camera.lookAt(0, 0, 0)

const geometry = new SphereGeometry(1, 32, 32)
const material = new MeshBasicMaterial({ color: 0xffffff })
const sphere = new Mesh(geometry, material)
scene.add(sphere)

function draw(t) {
  const tex = getTexture(0)
  if (tex) {
    material.map = tex
    material.needsUpdate = true
  }
  sphere.rotation.y = t * 0.001
  renderer.render(scene, camera)
}`;

const CRATE_THREE = `const { Scene, PerspectiveCamera, BoxGeometry, Mesh, MeshBasicMaterial, ImageBitmapLoader, CanvasTexture } = THREE

const scene = new Scene()
const camera = new PerspectiveCamera(75, width / height, 0.1, 1000)
camera.position.z = 2

const geometry = new BoxGeometry(1, 1, 1)
const material = new MeshBasicMaterial({ color: 0xffffff })
const cube = new Mesh(geometry, material)
scene.add(cube)

const url = 'https://threejs.org/examples/textures/crate.gif'
const loader = new ImageBitmapLoader()

loader.load(url, (bitmap) => {
  const tex = new CanvasTexture(bitmap)
  material.map = tex
  material.needsUpdate = true
})

function draw(t) {
  cube.rotation.x += 0.01
  cube.rotation.y += 0.01
  renderer.render(scene, camera)
}`;

export const THREE_PRESETS: Record<string, { type: string; data: { code: string } }> = {
	'video-cube.three': { type: 'three', data: { code: VIDEO_CUBE_THREE.trim() } },
	'video-torus.three': { type: 'three', data: { code: VIDEO_TORUS_THREE.trim() } },
	'video-sphere.three': { type: 'three', data: { code: VIDEO_SPHERE_THREE.trim() } },
	'crate.three': { type: 'three', data: { code: CRATE_THREE.trim() } }
};
