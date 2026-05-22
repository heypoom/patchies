export type ShaderParkOrbitState = {
  theta: number;
  phi: number;
  radius: number;
  target: [number, number, number];
  lastX: number;
  lastY: number;
  dragging: boolean;
};

export type ShaderParkOrbitPointer = {
  mouseX: number;
  mouseY: number;
  mouseZ: number;
  mouseW: number;
};

const ROTATION_SPEED = 0.005;
const ZOOM_SPEED = 0.001;
const MIN_PHI = -Math.PI / 2 + 0.01;
const MAX_PHI = Math.PI / 2 - 0.01;
const MIN_RADIUS = 1.2;
const MAX_RADIUS = 20;

export function createShaderParkOrbitState(): ShaderParkOrbitState {
  return {
    theta: 0,
    phi: 0,
    radius: 3,
    target: [0, 0, 0],
    lastX: 0,
    lastY: 0,
    dragging: false
  };
}

export function updateShaderParkOrbit(
  state: ShaderParkOrbitState,
  pointer: ShaderParkOrbitPointer
) {
  const isPressed = pointer.mouseZ >= 0 && pointer.mouseW >= 0;

  if (!isPressed) {
    state.dragging = false;
    state.lastX = pointer.mouseX;
    state.lastY = pointer.mouseY;
    return;
  }

  if (!state.dragging) {
    state.dragging = true;
    state.lastX = pointer.mouseX;
    state.lastY = pointer.mouseY;
    return;
  }

  const dx = pointer.mouseX - state.lastX;
  const dy = pointer.mouseY - state.lastY;

  state.theta += dx * ROTATION_SPEED;
  state.phi = Math.max(MIN_PHI, Math.min(MAX_PHI, state.phi + dy * ROTATION_SPEED));
  state.lastX = pointer.mouseX;
  state.lastY = pointer.mouseY;
}

export function zoomShaderParkOrbit(state: ShaderParkOrbitState, deltaY: number) {
  const zoomFactor = Math.exp(deltaY * ZOOM_SPEED);

  state.radius = Math.max(MIN_RADIUS, Math.min(MAX_RADIUS, state.radius * zoomFactor));
}

export function getShaderParkOrbitCameraPosition(
  state: ShaderParkOrbitState
): [number, number, number] {
  const cosPhi = Math.cos(state.phi);
  const x = state.target[0] + state.radius * Math.sin(state.theta) * cosPhi;
  const y = state.target[1] + state.radius * Math.sin(state.phi);
  const z = state.target[2] + state.radius * Math.cos(state.theta) * cosPhi;

  return [x, y, z];
}
