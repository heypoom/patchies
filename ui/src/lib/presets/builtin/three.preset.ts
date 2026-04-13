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
const POINT_CLOUD_FROM_TEXTURE = `setTitle('Point Cloud')

const {
  Scene, PerspectiveCamera, BufferGeometry, BufferAttribute,
  Points, ShaderMaterial, AdditiveBlending, Sphere, Vector3
} = THREE

setVideoCount(1, 1)
setPrimaryButton('settings')

await settings.define([
  { key: 'maxPoints', type: 'slider', label: 'Max Points', min: 1, max: 100000, step: 1, default: 65536 },
  { key: 'pointSize', type: 'slider', label: 'Point Size', min: 0.001, max: 0.05, step: 0.001, default: 0.02 }
])

let maxPoints = settings.get('maxPoints')
let pointSize = settings.get('pointSize')

const material = new ShaderMaterial({
  uniforms: {
    positionMap: { value: null },
    pointSize: { value: pointSize }
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
let needsRebuild = false

function buildPoints(w, h) {
  if (points) {
    scene.remove(points)
    points.geometry.dispose()
  }

  const total = w * h
  const stride = Math.max(1, Math.ceil(Math.sqrt(total / maxPoints)))

  const sw = Math.ceil(w / stride)
  const sh = Math.ceil(h / stride)

  const count = sw * sh
  const refs = new Float32Array(count * 2)

  let index = 0

  for (let y = 0; y < sh; y++) {
    for (let x = 0; x < sw; x++) {
      refs[index++] = (x * stride + 0.5) / w
      refs[index++] = (y * stride + 0.5) / h
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
  needsRebuild = false
}

settings.onChange((key, value) => {
  if (key === 'maxPoints') {
    maxPoints = value
    needsRebuild = true
  }

  if (key === 'pointSize') {
    pointSize = value
    material.uniforms.pointSize.value = value
  }
})

function draw(t) {
  const texture = getTexture(0)

  if (texture && texture.image) {
    const width = texture.image.width | 0
    const height = texture.image.height | 0

    if (width > 0 && height > 0 && (width !== currentW || height !== currentH || needsRebuild)) {
      buildPoints(width, height)
    }

    material.uniforms.positionMap.value = texture
  }

  renderer.render(scene, camera)
}`;

const MESH_SURFACE_FROM_TEXTURE = `setTitle('Mesh Surface')

const {
  Scene, PerspectiveCamera, PlaneGeometry, Mesh,
  ShaderMaterial, DoubleSide, Vector3
} = THREE

setVideoCount(1, 1)
setPrimaryButton('settings')

// --- Settings ---
await settings.define([
  { key: 'gridSize', type: 'slider', label: 'Grid Resolution', min: 4, max: 512, step: 1, default: 128 },
  { key: 'wireframe', type: 'boolean', label: 'Wireframe', default: false },
  { key: 'opacity', type: 'slider', label: 'Opacity', min: 0, max: 1, step: 0.01, default: 1.0 }
])

let gridSize = settings.get('gridSize')

// --- Shaders ---
const vertexShader = \`
  uniform sampler2D positionMap;
  varying vec3 vPos;
  varying vec2 vUv;

  void main() {
    vUv = uv;
    // Sample the RGB values from the input texture to use as XYZ coordinates
    vec4 tex = texture2D(positionMap, uv);
    vec3 p = tex.xyz;

    vPos = p;

    vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mvPosition;
  }
\`

const fragmentShader = \`
  varying vec3 vPos;
  varying vec2 vUv;
  uniform float uOpacity;

  void main() {
    // Calculate normals on the fly using screen-space derivatives
    // This creates faceted shading based on the displaced geometry
    vec3 fdx = dFdx(vPos);
    vec3 fdy = dFdy(vPos);
    vec3 normal = normalize(cross(fdx, fdy));

    // Simple directional lighting
    vec3 lightDir = normalize(vec3(1.0, 1.0, 1.0));
    float diffuse = max(dot(normal, lightDir), 0.0) * 0.5 + 0.5;

    // Color based on position
    vec3 color = 0.5 + 0.5 * normalize(vPos);

    gl_FragColor = vec4(color * diffuse, uOpacity);
  }
\` // Note: Using standard GLSL derivatives for shading

// --- Initialization ---
const material = new ShaderMaterial({
  uniforms: {
    positionMap: { value: null },
    uOpacity: { value: settings.get('opacity') }
  },
  vertexShader,
  fragmentShader,
  side: DoubleSide,
  transparent: true,
  wireframe: settings.get('wireframe'),
  extensions: { derivatives: true }
})

const scene = new Scene()
const camera = new PerspectiveCamera(60, width / height, 0.1, 1000)
camera.position.set(0, 0, 3)

let mesh = null

function buildMesh(res) {
  if (mesh) {
    scene.remove(mesh)
    mesh.geometry.dispose()
  }

  // Create a plane with segments matching our desired resolution
  // Each vertex in this plane will be moved by the vertex shader
  const geometry = new PlaneGeometry(1, 1, res, res)
  mesh = new Mesh(geometry, material)
  scene.add(mesh)
  gridSize = res
}

buildMesh(gridSize)

// --- Updates ---
settings.onChange((key, value) => {
  if (key === 'gridSize') {
    buildMesh(value)
  }

  if (key === 'wireframe') {
    material.wireframe = value
  }

  if (key === 'opacity') {
    material.uniforms.uOpacity.value = value
  }
})

function draw(t) {
  const texture = getTexture(0)

  if (texture) {
    material.uniforms.positionMap.value = texture
  }

  renderer.render(scene, camera)
}`;

export const THREE_PRESETS: Record<string, { type: string; data: { code: string } }> = {
  'three>': { type: 'three', data: { code: PIPE_THREE.trim() } },
  'video-cube.three': { type: 'three', data: { code: VIDEO_CUBE_THREE.trim() } },
  'video-torus.three': { type: 'three', data: { code: VIDEO_TORUS_THREE.trim() } },
  'video-sphere.three': { type: 'three', data: { code: VIDEO_SPHERE_THREE.trim() } },
  'crate.three': { type: 'three', data: { code: CRATE_THREE.trim() } },
  'point-cloud-from-texture.three': {
    type: 'three',
    data: { code: POINT_CLOUD_FROM_TEXTURE.trim() }
  },
  'mesh-surface-from-texture.three': {
    type: 'three',
    data: { code: MESH_SURFACE_FROM_TEXTURE.trim() }
  }
};
