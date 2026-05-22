import { describe, expect, it } from 'vitest';
import { WorkerThreeInteraction, createWorkerOrbitControlsClass } from './workerThreeInteraction';
import * as THREE from 'three';

describe('worker three interaction', () => {
  it('emits raw drag events from forwarded pointer state', () => {
    const interaction = new WorkerThreeInteraction();
    const events: Array<{ dx: number; dy: number; buttons: number; down: boolean }> = [];

    interaction.onPointerDrag((event) => events.push(event));
    interaction.updatePointer({ mouseX: 10, mouseY: 20, mouseZ: 10, mouseW: 20, mouseButtons: 1 });
    interaction.updatePointer({ mouseX: 16, mouseY: 28, mouseZ: 10, mouseW: 20, mouseButtons: 1 });

    expect(events).toHaveLength(2);
    expect(events[0]).toMatchObject({ dx: 0, dy: 0, buttons: 1, down: true });
    expect(events[1]).toMatchObject({ dx: 6, dy: 8, buttons: 1, down: true });
    expect(interaction.mouse.dx).toBe(6);
    expect(interaction.mouse.dy).toBe(8);
  });

  it('emits raw wheel events and stores the latest wheel delta', () => {
    const interaction = new WorkerThreeInteraction();
    const events: Array<{ deltaX: number; deltaY: number; deltaMode: number }> = [];

    interaction.onWheel((event) => events.push(event));
    interaction.queueWheel({ x: 20, y: 30, deltaX: 1, deltaY: -120, deltaMode: 0 });
    interaction.flushWheelCallbacks();

    expect(events).toEqual([{ x: 20, y: 30, deltaX: 1, deltaY: -120, deltaMode: 0 }]);
    expect(interaction.mouse.wheelDelta).toBe(-120);
  });

  it('mimics OrbitControls rotation and wheel dolly for a perspective camera', () => {
    const interaction = new WorkerThreeInteraction();
    const OrbitControls = createWorkerOrbitControlsClass(THREE, interaction, () => [100, 100]);
    const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);
    camera.position.set(0, 0, 3);
    const controls = new OrbitControls(camera);

    interaction.updatePointer({ mouseX: 50, mouseY: 50, mouseZ: 50, mouseW: 50, mouseButtons: 1 });
    interaction.updatePointer({ mouseX: 70, mouseY: 60, mouseZ: 50, mouseW: 50, mouseButtons: 1 });
    controls.update();

    expect(camera.position.x).not.toBeCloseTo(0);

    const distance = controls.getDistance();
    interaction.queueWheel({ x: 70, y: 60, deltaX: 0, deltaY: -120, deltaMode: 0 });
    controls.update();

    expect(controls.getDistance()).toBeLessThan(distance);
  });

  it('mimics OrbitControls right-button panning', () => {
    const interaction = new WorkerThreeInteraction();
    const OrbitControls = createWorkerOrbitControlsClass(THREE, interaction, () => [100, 100]);
    const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);
    camera.position.set(0, 0, 3);
    const controls = new OrbitControls(camera);

    interaction.updatePointer({ mouseX: 50, mouseY: 50, mouseZ: 50, mouseW: 50, mouseButtons: 2 });
    interaction.updatePointer({ mouseX: 70, mouseY: 60, mouseZ: 50, mouseW: 50, mouseButtons: 2 });
    controls.update();

    expect(controls.target.x).not.toBeCloseTo(0);
    expect(camera.position.x).not.toBeCloseTo(0);
  });
});
