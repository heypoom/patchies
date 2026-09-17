import type { ObjectInlet } from '$lib/objects/v2/object-metadata';
import { useObjectDataTracker } from '$lib/history';
import { getPatchRuntime } from '$lib/runtime';
import { MessageSystem } from '$lib/messages/MessageSystem';

import type { ObjectNodeData } from './types';

import {
  getDraggedParameterValue,
  isDraggableParameter,
  getDraggedOscillatorWaveform,
  isDraggableOscillatorWaveform
} from './parameter-drag';

type ObjectParameterDragOptions = {
  getNodeId: () => string;
  getData: () => ObjectNodeData;
  getInlets: () => ObjectInlet[];
};

export function useObjectParameterDrag(options: ObjectParameterDragOptions) {
  const patchRuntime = getPatchRuntime();

  const objectDataTracker = $derived.by(() =>
    useObjectDataTracker(options.getNodeId(), options.getData)
  );

  const canDragWaveform = (index: number, value: unknown) =>
    options.getData().name === 'osc~' &&
    options.getInlets()[index]?.name === 'type' &&
    isDraggableOscillatorWaveform(value) &&
    patchRuntime?.getAudioObject(options.getNodeId())?.getIcon?.() !== 'waveform:custom';

  function attachParameterDrag(element: HTMLDivElement) {
    let drag: {
      pointerId: number;
      index: number;
      startY: number;
      getValue: (deltaY: number) => number | string | null;
    } | null = null;

    function finishDrag() {
      if (!drag) return;

      const { pointerId } = drag;
      drag = null;

      if (element.hasPointerCapture(pointerId)) {
        element.releasePointerCapture(pointerId);
      }

      objectDataTracker.commitIfChanged();
    }

    function startDrag(event: PointerEvent) {
      if (!event.altKey || event.button !== 0) return;

      event.preventDefault();
      event.stopPropagation();

      const target = event.target;
      const parameter = target instanceof Element ? target.closest('[data-param-index]') : null;
      if (!parameter || drag) return;

      const index = Number(parameter.getAttribute('data-param-index'));
      const inlet = options.getInlets()[index];
      const value = options.getData().params[index];
      if (!inlet) return;

      let getValue: (deltaY: number) => number | string | null;

      if (typeof value === 'number' && isDraggableParameter(inlet, value)) {
        getValue = (deltaY) =>
          getDraggedParameterValue({
            inlet,
            startValue: value,
            deltaY
          });
      } else if (canDragWaveform(index, value)) {
        getValue = (deltaY) =>
          canDragWaveform(index, options.getData().params[index])
            ? getDraggedOscillatorWaveform({ startValue: value, deltaY })
            : null;
      } else {
        return;
      }

      objectDataTracker.capture();

      drag = {
        pointerId: event.pointerId,
        index,
        startY: event.clientY,
        getValue
      };

      element.setPointerCapture(event.pointerId);
    }

    function moveDrag(event: PointerEvent) {
      if (!drag || event.pointerId !== drag.pointerId) return;

      event.preventDefault();
      event.stopPropagation();

      const value = drag.getValue(drag.startY - event.clientY);

      if (value !== null && value !== options.getData().params[drag.index]) {
        const nodeId = options.getNodeId();

        // Use the inlet path so the live object handles the value before its view updates.
        MessageSystem.getInstance().registerNode(nodeId).sendMessage({
          source: nodeId,
          inlet: drag.index,
          data: value
        });
      }
    }

    function endDrag(event: PointerEvent) {
      if (event.pointerId === drag?.pointerId) {
        finishDrag();
      }
    }

    // XYFlow starts dragging in a native ancestor mousedown listener, before
    // Svelte's delegated handlers run. Block that event on the object itself.
    function preventAltNodeDrag(event: MouseEvent) {
      if (!event.altKey && !drag) return;

      event.preventDefault();
      event.stopPropagation();
    }

    element.addEventListener('pointerdown', startDrag);
    element.addEventListener('pointermove', moveDrag);
    element.addEventListener('pointerup', endDrag);
    element.addEventListener('pointercancel', endDrag);
    element.addEventListener('lostpointercapture', endDrag);
    element.addEventListener('mousedown', preventAltNodeDrag);
    element.addEventListener('dblclick', preventAltNodeDrag);

    window.addEventListener('blur', finishDrag);

    return () => {
      finishDrag();

      element.removeEventListener('pointerdown', startDrag);
      element.removeEventListener('pointermove', moveDrag);
      element.removeEventListener('pointerup', endDrag);
      element.removeEventListener('pointercancel', endDrag);
      element.removeEventListener('lostpointercapture', endDrag);
      element.removeEventListener('mousedown', preventAltNodeDrag);
      element.removeEventListener('dblclick', preventAltNodeDrag);

      window.removeEventListener('blur', finishDrag);
    };
  }

  function getHint(index: number): string | null {
    const inlet = options.getInlets()[index];
    const value = options.getData().params[index];

    if (isDraggableParameter(inlet, value)) {
      return 'Alt-drag up/down to adjust';
    }

    if (canDragWaveform(index, value)) {
      return 'Alt-drag up/down to change waveform';
    }

    return null;
  }

  return { attach: attachParameterDrag, getHint };
}
