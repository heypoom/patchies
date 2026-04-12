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

const PIPE_THREE = `const { Scene, OrthographicCamera, PlaneGeometry, Mesh, MeshBasicMaterial } = THREE

setVideoCount(1, 1)

settings.define([
  { key: 'opacity', label: 'Opacity', type: 'slider', min: 0, max: 1, step: 0.01, default: 1 }
])

const scene = new Scene()
const camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1)
const geometry = new PlaneGeometry(2, 2)

const material = new MeshBasicMaterial({
  color: 0xffffff,
  transparent: true,
  opacity: 0,
  visible: false
})

const plane = new Mesh(geometry, material)
scene.add(plane)

function draw(t) {
  const tex = getTexture(0)
  const op = settings.get('opacity')

  if (tex) {
    material.map = tex
    material.visible = true
    material.opacity = op
    material.transparent = op < 1
    material.needsUpdate = true
  } else {
    material.map = null
    material.visible = false
  }

  renderer.render(scene, camera)
}`;

// Stage 1 of spec 115: render a point cloud whose vertex positions come from
// a float (rgba32f) texture on inlet 0. Convention: texture width × height =
// vertex count, row-major. Wire a GLSL/SwissGL node that outputs an rgba32f
// texture (e.g. via `// @format rgba32f`) into inlet 0. Geometry auto-resizes
// to match the incoming texture's dimensions.
const PARTICLES_FROM_TEXTURE_THREE = `const {
  Scene, PerspectiveCamera, BufferGeometry, BufferAttribute,
  Points, ShaderMaterial, AdditiveBlending, Sphere, Vector3
} = THREE

setVideoCount(1, 1)

const material = new ShaderMaterial({
  uniforms: {
    positionMap: { value: null },
    pointSize:   { value: 2.0 }
  },
  vertexShader: \`
    uniform sampler2D positionMap;
    uniform float pointSize;
    attribute vec2 ref;
    varying vec3 vPos;
    void main() {
      vec3 p = texture2D(positionMap, ref).xyz;
      vPos = p;
      vec4 mv = modelViewMatrix * vec4(p, 1.0);
      gl_Position = projectionMatrix * mv;
      gl_PointSize = pointSize * (300.0 / -mv.z);
    }
  \`,
  fragmentShader: \`
    varying vec3 vPos;
    void main() {
      vec2 d = gl_PointCoord - 0.5;
      if (dot(d, d) > 0.25) discard;
      gl_FragColor = vec4(0.5 + 0.5 * normalize(vPos), 1.0);
    }
  \`,
  transparent: true,
  blending: AdditiveBlending,
  depthWrite: false
})

const scene = new Scene()
const camera = new PerspectiveCamera(60, width / height, 0.1, 100)
camera.position.set(0, 0, 3)
camera.lookAt(0, 0, 0)

let points = null
let currentW = 0
let currentH = 0

// Cap point count to keep GPU happy. If the texture is larger, we stride
// through it evenly so the cloud still covers the full surface.
const MAX_POINTS = 65536

function buildPoints(w, h) {
  if (points) {
    scene.remove(points)
    points.geometry.dispose()
  }
  const total = w * h
  const stride = Math.max(1, Math.ceil(Math.sqrt(total / MAX_POINTS)))
  const sw = Math.ceil(w / stride)
  const sh = Math.ceil(h / stride)
  const count = sw * sh

  const refs = new Float32Array(count * 2)
  let idx = 0
  for (let y = 0; y < sh; y++) {
    for (let x = 0; x < sw; x++) {
      refs[idx++] = (x * stride + 0.5) / w
      refs[idx++] = (y * stride + 0.5) / h
    }
  }
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(count * 3), 3))
  geometry.setAttribute('ref', new BufferAttribute(refs, 2))
  geometry.boundingSphere = new Sphere(new Vector3(), 1e3)
  points = new Points(geometry, material)
  scene.add(points)
  currentW = w
  currentH = h
}

function draw(t) {
  const tex = getTexture(0)
  if (tex && tex.image) {
    const w = tex.image.width | 0
    const h = tex.image.height | 0
    if (w > 0 && h > 0 && (w !== currentW || h !== currentH)) {
      buildPoints(w, h)
    }
    material.uniforms.positionMap.value = tex
  }
  if (points) points.rotation.y = t * 0.0003
  renderer.render(scene, camera)
}`;

export const THREE_PRESETS: Record<string, { type: string; data: { code: string } }> = {
  'three>': { type: 'three', data: { code: PIPE_THREE.trim() } },
  'video-cube.three': { type: 'three', data: { code: VIDEO_CUBE_THREE.trim() } },
  'video-torus.three': { type: 'three', data: { code: VIDEO_TORUS_THREE.trim() } },
  'video-sphere.three': { type: 'three', data: { code: VIDEO_SPHERE_THREE.trim() } },
  'crate.three': { type: 'three', data: { code: CRATE_THREE.trim() } },
  'particles-from-texture.three': {
    type: 'three',
    data: { code: PARTICLES_FROM_TEXTURE_THREE.trim() }
  }
};
