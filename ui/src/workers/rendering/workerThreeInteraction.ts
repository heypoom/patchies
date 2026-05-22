import type { OrthographicCamera, PerspectiveCamera, Spherical, Vector3 } from 'three';

type ThreeModule = typeof import('three');
type ControlledCamera = PerspectiveCamera | OrthographicCamera;

export type WorkerPointerState = {
  mouseX: number;
  mouseY: number;
  mouseZ: number;
  mouseW: number;
  mouseButtons?: number;
};

export type WorkerPointerDragEvent = {
  x: number;
  y: number;
  dx: number;
  dy: number;
  startX: number;
  startY: number;
  buttons: number;
  down: boolean;
};

export type WorkerWheelEvent = {
  x: number;
  y: number;
  deltaX: number;
  deltaY: number;
  deltaMode: number;
};

type OrbitSnapshot = {
  position: [number, number, number];
  target: [number, number, number];
  zoom?: number;
};

export class WorkerThreeInteraction {
  readonly mouse = {
    x: 0,
    y: 0,
    down: false,
    buttons: 0,
    dx: 0,
    dy: 0,
    wheelDelta: 0
  };

  private dragCallbacks = new Set<(event: WorkerPointerDragEvent) => void>();
  private wheelCallbacks = new Set<(event: WorkerWheelEvent) => void>();
  private dragEvents: WorkerPointerDragEvent[] = [];
  private wheelEvents: WorkerWheelEvent[] = [];
  private notifiedWheelCount = 0;
  private lastX = 0;
  private lastY = 0;
  private hasPointer = false;
  private orbitSnapshot: OrbitSnapshot | null = null;

  onPointerDrag(callback: (event: WorkerPointerDragEvent) => void) {
    this.dragCallbacks.add(callback);

    return () => this.dragCallbacks.delete(callback);
  }

  onWheel(callback: (event: WorkerWheelEvent) => void) {
    this.wheelCallbacks.add(callback);

    return () => this.wheelCallbacks.delete(callback);
  }

  clearCallbacks() {
    this.dragCallbacks.clear();
    this.wheelCallbacks.clear();
  }

  updatePointer(pointer: WorkerPointerState) {
    const down = pointer.mouseZ >= 0 && pointer.mouseW >= 0;
    const x = pointer.mouseX;
    const y = pointer.mouseY;
    const buttons = pointer.mouseButtons ?? (down ? 1 : 0);
    const dx = this.hasPointer ? x - this.lastX : 0;
    const dy = this.hasPointer ? y - this.lastY : 0;

    this.mouse.x = x;
    this.mouse.y = y;
    this.mouse.down = down;
    this.mouse.buttons = buttons;
    this.mouse.dx = down ? dx : 0;
    this.mouse.dy = down ? dy : 0;

    this.lastX = x;
    this.lastY = y;
    this.hasPointer = true;

    if (!down) {
      this.dragEvents = [];
      return;
    }

    const event: WorkerPointerDragEvent = {
      x,
      y,
      dx,
      dy,
      startX: Math.abs(pointer.mouseZ),
      startY: Math.abs(pointer.mouseW),
      buttons,
      down
    };

    this.dragEvents.push(event);

    for (const callback of this.dragCallbacks) {
      callback(event);
    }
  }

  queueWheel(event: WorkerWheelEvent) {
    this.mouse.x = event.x;
    this.mouse.y = event.y;
    this.mouse.wheelDelta = event.deltaY;
    this.wheelEvents.push(event);
  }

  flushWheelCallbacks() {
    for (const event of this.wheelEvents.slice(this.notifiedWheelCount)) {
      for (const callback of this.wheelCallbacks) {
        callback(event);
      }
    }

    this.notifiedWheelCount = this.wheelEvents.length;
  }

  consumeDragEvents() {
    const events = this.dragEvents;
    this.dragEvents = [];
    return events;
  }

  consumeWheelEvents() {
    const events = this.wheelEvents;
    this.wheelEvents = [];
    this.notifiedWheelCount = 0;
    return events;
  }

  saveOrbitSnapshot(camera: ControlledCamera, target: Vector3) {
    this.orbitSnapshot = {
      position: camera.position.toArray() as [number, number, number],
      target: target.toArray() as [number, number, number],
      zoom: 'zoom' in camera ? camera.zoom : undefined
    };
  }

  restoreOrbitSnapshot(camera: ControlledCamera, target: Vector3) {
    if (!this.orbitSnapshot) return false;

    camera.position.fromArray(this.orbitSnapshot.position);
    target.fromArray(this.orbitSnapshot.target);

    if ('zoom' in camera && this.orbitSnapshot.zoom !== undefined) {
      camera.zoom = this.orbitSnapshot.zoom;
      camera.updateProjectionMatrix();
    }

    return true;
  }
}

export function createWorkerOrbitControlsClass(
  THREE: ThreeModule,
  interaction: WorkerThreeInteraction,
  getSize: () => [number, number]
) {
  return class OrbitControls {
    enabled = true;
    enableRotate = true;
    enablePan = true;
    enableZoom = true;
    rotateSpeed = 1;
    panSpeed = 1;
    zoomSpeed = 1;
    minDistance = 0;
    maxDistance = Infinity;
    screenSpacePanning = true;
    mouseButtons = {
      LEFT: THREE.MOUSE.ROTATE,
      MIDDLE: THREE.MOUSE.DOLLY,
      RIGHT: THREE.MOUSE.PAN
    };
    target: Vector3;

    private spherical: Spherical;
    private position0: Vector3;
    private target0: Vector3;
    private zoom0: number;

    constructor(
      public object: ControlledCamera,
      public domElement?: unknown
    ) {
      this.target = new THREE.Vector3();
      interaction.restoreOrbitSnapshot(object, this.target);
      this.spherical = new THREE.Spherical().setFromVector3(
        object.position.clone().sub(this.target)
      );
      this.position0 = object.position.clone();
      this.target0 = this.target.clone();
      this.zoom0 = 'zoom' in object ? object.zoom : 1;
      this.update();
    }

    update() {
      if (!this.enabled) return false;

      let changed = false;

      for (const event of interaction.consumeDragEvents()) {
        changed = this.applyDragEvent(event) || changed;
      }

      for (const event of interaction.consumeWheelEvents()) {
        if (!this.enableZoom) continue;

        const zoomFactor = Math.exp(event.deltaY * 0.001 * this.zoomSpeed);
        this.spherical.radius *= zoomFactor;
        changed = true;
      }

      this.applyCamera();
      interaction.saveOrbitSnapshot(this.object, this.target);

      return changed;
    }

    dispose() {}

    saveState() {
      this.position0.copy(this.object.position);
      this.target0.copy(this.target);
      this.zoom0 = 'zoom' in this.object ? this.object.zoom : 1;
    }

    reset() {
      this.object.position.copy(this.position0);
      this.target.copy(this.target0);

      if ('zoom' in this.object) {
        this.object.zoom = this.zoom0;
        this.object.updateProjectionMatrix();
      }

      this.syncSphericalFromCamera();
      this.applyCamera();
    }

    getDistance() {
      return this.object.position.distanceTo(this.target);
    }

    getAzimuthalAngle() {
      return this.spherical.theta;
    }

    getPolarAngle() {
      return this.spherical.phi;
    }

    rotateLeft(angle: number) {
      this.spherical.theta -= angle;
    }

    rotateUp(angle: number) {
      this.spherical.phi -= angle;
    }

    pan(deltaX: number, deltaY: number) {
      this.applyPan(deltaX, deltaY);
    }

    dollyIn(dollyScale: number) {
      this.spherical.radius /= dollyScale;
    }

    dollyOut(dollyScale: number) {
      this.spherical.radius *= dollyScale;
    }

    private applyDragEvent(event: WorkerPointerDragEvent) {
      const action = this.getMouseAction(event.buttons);

      if (action === THREE.MOUSE.PAN && this.enablePan) {
        this.applyPan(event.dx, event.dy);
        return true;
      }

      if (action === THREE.MOUSE.DOLLY && this.enableZoom) {
        this.spherical.radius *= Math.exp(event.dy * 0.01 * this.zoomSpeed);
        return true;
      }

      if (action === THREE.MOUSE.ROTATE && this.enableRotate) {
        const [, height] = getSize();
        const safeHeight = Math.max(1, height);

        this.rotateLeft(((2 * Math.PI * event.dx) / safeHeight) * this.rotateSpeed);
        this.rotateUp(((2 * Math.PI * event.dy) / safeHeight) * this.rotateSpeed);
        return true;
      }

      return false;
    }

    private getMouseAction(buttons: number) {
      if ((buttons & 2) === 2) return this.mouseButtons.RIGHT;
      if ((buttons & 4) === 4) return this.mouseButtons.MIDDLE;
      return this.mouseButtons.LEFT;
    }

    private applyPan(deltaX: number, deltaY: number) {
      const [, height] = getSize();
      const safeHeight = Math.max(1, height);
      const offset = this.object.position.clone().sub(this.target);
      const targetDistance = this.getPerspectiveTargetDistance(offset);
      const panX = ((2 * deltaX * targetDistance) / safeHeight) * this.panSpeed;
      const panY = ((2 * deltaY * targetDistance) / safeHeight) * this.panSpeed;
      const panOffset = new THREE.Vector3();
      const matrix = this.object.matrix;

      panOffset.setFromMatrixColumn(matrix, 0).multiplyScalar(-panX);
      this.object.position.add(panOffset);
      this.target.add(panOffset);

      panOffset.setFromMatrixColumn(matrix, 1).multiplyScalar(panY);
      this.object.position.add(panOffset);
      this.target.add(panOffset);

      this.syncSphericalFromCamera();
    }

    private getPerspectiveTargetDistance(offset: Vector3) {
      if ('isPerspectiveCamera' in this.object && this.object.isPerspectiveCamera) {
        return (
          offset.length() * Math.tan(((this.object as PerspectiveCamera).fov / 2) * (Math.PI / 180))
        );
      }

      return offset.length();
    }

    private syncSphericalFromCamera() {
      this.spherical.setFromVector3(this.object.position.clone().sub(this.target));
    }

    private applyCamera() {
      this.spherical.makeSafe();
      this.spherical.radius = Math.max(
        this.minDistance,
        Math.min(this.maxDistance, this.spherical.radius)
      );

      const offset = new THREE.Vector3().setFromSpherical(this.spherical);
      this.object.position.copy(this.target).add(offset);
      this.object.lookAt(this.target);
      this.object.updateProjectionMatrix();
    }
  };
}

export type WorkerOrbitControls = InstanceType<ReturnType<typeof createWorkerOrbitControlsClass>>;
