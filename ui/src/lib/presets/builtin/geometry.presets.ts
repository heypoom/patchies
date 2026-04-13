// Stage 2 prototype: CPU geometry flowing between nodes as messages.
// Uses primitive-geometry library for generation (loaded via esm.sh at runtime).
// Convention: { type: 'geometry', positions: TypedArray, normals?: TypedArray, indices?: TypedArray, topology: 'triangles' }

const GEO_BOX = `setTitle('geo.box')
setRunOnMount(true)
setPortCount(0, 1)

import { cube } from 'npm:primitive-geometry'

await settings.define([
  { key: 'sx', type: 'slider', label: 'Width', min: 0.1, max: 4, step: 0.01, default: 1 },
  { key: 'sy', type: 'slider', label: 'Height', min: 0.1, max: 4, step: 0.01, default: 1 },
  { key: 'sz', type: 'slider', label: 'Depth', min: 0.1, max: 4, step: 0.01, default: 1 },
  { key: 'nx', type: 'slider', label: 'Subdivisions', min: 1, max: 10, step: 1, default: 1 }
])

function emit() {
  const g = cube({
    sx: settings.get('sx'),
    sy: settings.get('sy'),
    sz: settings.get('sz'),
    nx: settings.get('nx')
  })

  send({
    type: 'geometry',
    positions: g.positions,
    normals: g.normals,
    indices: g.cells,
    topology: 'triangles'
  })
}

emit()
settings.onChange(() => emit())`;

const GEO_SPHERE = `setTitle('geo.sphere')
setRunOnMount(true)
setPortCount(0, 1)

import { sphere } from 'npm:primitive-geometry'

await settings.define([
  { key: 'radius', type: 'slider', label: 'Radius', min: 0.1, max: 4, step: 0.01, default: 0.5 },
  { key: 'nx', type: 'slider', label: 'Segments X', min: 4, max: 64, step: 1, default: 32 },
  { key: 'ny', type: 'slider', label: 'Segments Y', min: 4, max: 64, step: 1, default: 16 }
])

function emit() {
  const g = sphere({
    radius: settings.get('radius'),
    nx: settings.get('nx'),
    ny: settings.get('ny')
  })

  send({
    type: 'geometry',
    positions: g.positions,
    normals: g.normals,
    indices: g.cells,
    topology: 'triangles'
  })
}

emit()
settings.onChange(() => emit())`;

const GEO_TORUS = `setTitle('geo.torus')
setRunOnMount(true)
setPortCount(0, 1)

import { torus } from 'npm:primitive-geometry'

await settings.define([
  { key: 'radius', type: 'slider', label: 'Radius', min: 0.1, max: 4, step: 0.01, default: 0.4 },
  { key: 'minorRadius', type: 'slider', label: 'Tube Radius', min: 0.01, max: 2, step: 0.01, default: 0.1 },
  { key: 'segments', type: 'slider', label: 'Segments', min: 3, max: 128, step: 1, default: 64 },
  { key: 'minorSegments', type: 'slider', label: 'Minor Segments', min: 3, max: 64, step: 1, default: 32 }
])

function emit() {
  const g = torus({
    radius: settings.get('radius'),
    minorRadius: settings.get('minorRadius'),
    segments: settings.get('segments'),
    minorSegments: settings.get('minorSegments')
  })

  send({
    type: 'geometry',
    positions: g.positions,
    normals: g.normals,
    indices: g.cells,
    topology: 'triangles'
  })
}

emit()
settings.onChange(() => emit())`;

const GEO_ICOSPHERE = `setTitle('geo.icosphere')
setRunOnMount(true)
setPortCount(0, 1)

import { icosphere } from 'npm:primitive-geometry'

await settings.define([
  { key: 'radius', type: 'slider', label: 'Radius', min: 0.1, max: 4, step: 0.01, default: 0.5 },
  { key: 'subdivisions', type: 'slider', label: 'Subdivisions', min: 0, max: 5, step: 1, default: 2 }
])

function emit() {
  const g = icosphere({
    radius: settings.get('radius'),
    subdivisions: settings.get('subdivisions')
  })

  send({
    type: 'geometry',
    positions: g.positions,
    normals: g.normals,
    indices: g.cells,
    topology: 'triangles'
  })
}

emit()
settings.onChange(() => emit())`;

const GEO_CYLINDER = `setTitle('geo.cylinder')
setRunOnMount(true)
setPortCount(0, 1)

import { cylinder } from 'npm:primitive-geometry'

await settings.define([
  { key: 'height', type: 'slider', label: 'Height', min: 0.1, max: 4, step: 0.01, default: 1 },
  { key: 'radius', type: 'slider', label: 'Radius', min: 0.01, max: 2, step: 0.01, default: 0.25 },
  { key: 'nx', type: 'slider', label: 'Segments', min: 3, max: 64, step: 1, default: 16 }
])

function emit() {
  const g = cylinder({
    height: settings.get('height'),
    radius: settings.get('radius'),
    nx: settings.get('nx')
  })

  send({
    type: 'geometry',
    positions: g.positions,
    normals: g.normals,
    indices: g.cells,
    topology: 'triangles'
  })
}

emit()
settings.onChange(() => emit())`;

const GEO_CAPSULE = `setTitle('geo.capsule')
setRunOnMount(true)
setPortCount(0, 1)

import { capsule } from 'npm:primitive-geometry'

await settings.define([
  { key: 'height', type: 'slider', label: 'Height', min: 0.1, max: 4, step: 0.01, default: 0.5 },
  { key: 'radius', type: 'slider', label: 'Radius', min: 0.01, max: 2, step: 0.01, default: 0.25 },
  { key: 'nx', type: 'slider', label: 'Segments', min: 3, max: 64, step: 1, default: 16 }
])

function emit() {
  const g = capsule({
    height: settings.get('height'),
    radius: settings.get('radius'),
    nx: settings.get('nx')
  })

  send({
    type: 'geometry',
    positions: g.positions,
    normals: g.normals,
    indices: g.cells,
    topology: 'triangles'
  })
}

emit()
settings.onChange(() => emit())`;

const GEO_RENDER = `setTitle('geo.render')

const {
  Scene, PerspectiveCamera, BufferGeometry, BufferAttribute,
  Mesh, MeshPhongMaterial, DirectionalLight, AmbientLight,
  Color, DoubleSide
} = THREE

setVideoCount(0, 1)
setPrimaryButton('settings')

await settings.define([
  { key: 'wireframe', type: 'boolean', label: 'Wireframe', default: false },
  { key: 'flatShading', type: 'boolean', label: 'Flat Shading', default: true },
  { key: 'color', type: 'color', label: 'Color', default: '#4488ff' },
  { key: 'autoRotate', type: 'boolean', label: 'Auto Rotate', default: true }
])

const scene = new Scene()
scene.background = new Color(0x1a1a1a)

const camera = new PerspectiveCamera(60, width / height, 0.1, 100)
camera.position.set(2, 1.5, 3)
camera.lookAt(0, 0, 0)

scene.add(new AmbientLight(0x404040))
const light = new DirectionalLight(0xffffff, 1)
light.position.set(5, 5, 5)
scene.add(light)

const material = new MeshPhongMaterial({
  color: settings.get('color'),
  flatShading: settings.get('flatShading'),
  wireframe: settings.get('wireframe'),
  side: DoubleSide
})

let mesh = null

recv(data => {
  if (data?.type !== 'geometry') return

  if (mesh) {
    scene.remove(mesh)
    mesh.geometry.dispose()
  }

  const geo = new BufferGeometry()
  geo.setAttribute('position', new BufferAttribute(new Float32Array(data.positions), 3))

  if (data.normals) {
    geo.setAttribute('normal', new BufferAttribute(new Float32Array(data.normals), 3))
  }

  if (data.indices) {
    geo.setIndex(new BufferAttribute(new Uint32Array(data.indices), 1))
  }

  if (!data.normals) geo.computeVertexNormals()

  mesh = new Mesh(geo, material)
  scene.add(mesh)
})

settings.onChange((key, value) => {
  if (key === 'wireframe') material.wireframe = value
  if (key === 'flatShading') {
    material.flatShading = value
    material.needsUpdate = true
  }
  if (key === 'color') material.color.set(value)
})

function draw(t) {
  if (mesh && settings.get('autoRotate')) {
    mesh.rotation.y = t * 0.001
  }

  renderer.render(scene, camera)
}`;

export const GEOMETRY_PRESETS: Record<string, { type: string; data: Record<string, unknown> }> = {
  'geo.box': {
    type: 'js',
    data: { code: GEO_BOX.trim(), showConsole: false, runOnMount: true }
  },
  'geo.sphere': {
    type: 'js',
    data: { code: GEO_SPHERE.trim(), showConsole: false, runOnMount: true }
  },
  'geo.torus': {
    type: 'js',
    data: { code: GEO_TORUS.trim(), showConsole: false, runOnMount: true }
  },
  'geo.icosphere': {
    type: 'js',
    data: { code: GEO_ICOSPHERE.trim(), showConsole: false, runOnMount: true }
  },
  'geo.cylinder': {
    type: 'js',
    data: { code: GEO_CYLINDER.trim(), showConsole: false, runOnMount: true }
  },
  'geo.capsule': {
    type: 'js',
    data: { code: GEO_CAPSULE.trim(), showConsole: false, runOnMount: true }
  },
  'geo.render': {
    type: 'three',
    data: { code: GEO_RENDER.trim(), messageInletCount: 1, videoOutletCount: 1 }
  }
};
