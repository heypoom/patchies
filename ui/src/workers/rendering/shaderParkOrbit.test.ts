import { describe, expect, it, vi } from 'vitest';
import { ShaderParkThreeRenderer } from './shaderParkThreeRenderer';
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

  it('keeps orbit state when Shader Park 3D code is updated', async () => {
    type TestShaderParkThreeRenderer = {
      config: { code: string; nodeId: string; size: [number, number] };
      framebuffer: unknown;
      orbit: ReturnType<typeof createShaderParkOrbitState>;
      updateCode: ReturnType<typeof vi.fn>;
      updateConfig: (
        config: { code: string; nodeId: string; size: [number, number] },
        framebuffer: never
      ) => Promise<void>;
    };
    const renderer = Object.create(
      ShaderParkThreeRenderer.prototype
    ) as TestShaderParkThreeRenderer;

    renderer.config = { code: 'sphere(0.5);', nodeId: 'shaderpark-1', size: [640, 480] };
    renderer.framebuffer = { id: 'old-framebuffer' };
    renderer.orbit = createShaderParkOrbitState();
    renderer.updateCode = vi.fn(async () => undefined);

    updateShaderParkOrbit(renderer.orbit, {
      mouseX: 100,
      mouseY: 100,
      mouseZ: 100,
      mouseW: 100
    });
    updateShaderParkOrbit(renderer.orbit, {
      mouseX: 180,
      mouseY: 130,
      mouseZ: 100,
      mouseW: 100
    });
    zoomShaderParkOrbit(renderer.orbit, -120);

    const orbit = renderer.orbit;

    await renderer.updateConfig(
      { code: 'sphere(0.8);', nodeId: 'shaderpark-1', size: [640, 480] },
      { id: 'new-framebuffer' } as never
    );

    expect(renderer.orbit).toBe(orbit);
    expect(renderer.orbit.theta).toBeGreaterThan(0);
    expect(renderer.orbit.radius).toBeLessThan(3);
    expect(renderer.updateCode).toHaveBeenCalledTimes(1);
  });
});
