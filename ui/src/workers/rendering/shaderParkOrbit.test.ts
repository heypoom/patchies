import { describe, expect, it } from 'vitest';
import {
  createShaderParkOrbitState,
  updateShaderParkOrbit,
  zoomShaderParkOrbit
} from './shaderParkOrbit';

describe('shaderpark 3d orbit', () => {
  it('rotates while forwarded pointer data is pressed', () => {
    const state = createShaderParkOrbitState();

    updateShaderParkOrbit(state, { mouseX: 100, mouseY: 100, mouseZ: 100, mouseW: 100 });
    updateShaderParkOrbit(state, { mouseX: 164, mouseY: 132, mouseZ: 100, mouseW: 100 });

    expect(state.theta).toBeGreaterThan(0);
    expect(state.phi).toBeGreaterThan(0);
  });

  it('does not rotate after the forwarded pointer is released', () => {
    const state = createShaderParkOrbitState();

    updateShaderParkOrbit(state, { mouseX: 100, mouseY: 100, mouseZ: 100, mouseW: 100 });
    updateShaderParkOrbit(state, { mouseX: 164, mouseY: 132, mouseZ: 100, mouseW: 100 });

    const theta = state.theta;
    const phi = state.phi;

    updateShaderParkOrbit(state, { mouseX: 200, mouseY: 180, mouseZ: -100, mouseW: -100 });

    expect(state.theta).toBe(theta);
    expect(state.phi).toBe(phi);
  });

  it('zooms in and out from forwarded wheel delta', () => {
    const state = createShaderParkOrbitState();
    const initialRadius = state.radius;

    zoomShaderParkOrbit(state, -120);

    expect(state.radius).toBeLessThan(initialRadius);

    zoomShaderParkOrbit(state, 120);

    expect(state.radius).toBeGreaterThan(initialRadius * 0.9);
  });

  it('clamps wheel zoom so the camera stays outside the raymarch volume', () => {
    const state = createShaderParkOrbitState();

    zoomShaderParkOrbit(state, -100_000);

    expect(state.radius).toBeGreaterThanOrEqual(1.2);
  });
});
