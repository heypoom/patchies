import type { GridRect, InlineValueWidgetInfo, NormalizedPoint } from '../types';

export function createXYGridDom(info: InlineValueWidgetInfo) {
  const grid = document.createElement('span');
  grid.className = 'cm-value-widget-xy-grid';
  grid.dataset.valueWidgetFrom = String(info.from);
  grid.dataset.valueWidgetTo = String(info.to);
  Object.assign(grid.style, {
    position: 'fixed',
    zIndex: '10000',
    width: '160px',
    height: '160px',
    border: '1px solid rgba(161, 161, 170, 0.9)',
    backgroundColor: 'rgba(24, 24, 27, 0.96)',
    backgroundImage:
      'linear-gradient(rgba(161, 161, 170, 0.24) 1px, transparent 1px), linear-gradient(90deg, rgba(161, 161, 170, 0.24) 1px, transparent 1px), linear-gradient(rgba(244, 244, 245, 0.42) 1px, transparent 1px), linear-gradient(90deg, rgba(244, 244, 245, 0.42) 1px, transparent 1px)',
    backgroundSize: '16px 16px, 16px 16px, 80px 80px, 80px 80px',
    boxShadow: '0 10px 28px rgba(0, 0, 0, 0.45)',
    cursor: 'crosshair',
    boxSizing: 'border-box'
  });

  const dot = document.createElement('span');
  dot.className = 'cm-value-widget-xy-dot';

  const [x, y] = info.components;
  dot.style.left = `${x.value * 100}%`;
  dot.style.top = `${(1 - y.value) * 100}%`;
  Object.assign(dot.style, {
    position: 'absolute',
    width: '8px',
    height: '8px',
    borderRadius: '999px',
    backgroundColor: 'rgb(244, 244, 245)',
    border: '1px solid rgb(9, 9, 11)',
    transform: 'translate(-50%, -50%)',
    pointerEvents: 'none',
    boxSizing: 'border-box'
  });

  grid.appendChild(dot);

  return grid;
}

export function gridRectFromEvent(event: MouseEvent): GridRect | null {
  if (!(event.target instanceof HTMLElement)) return null;
  const grid = event.target.closest<HTMLElement>('.cm-value-widget-xy-grid');
  if (!grid) return null;

  return gridRectFromElement(grid);
}

export function gridRectFromElement(grid: HTMLElement): GridRect | null {
  const rect = grid.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) return null;

  return {
    left: rect.left,
    top: rect.top,
    width: rect.width,
    height: rect.height
  };
}

export function pointFromGridRect(event: MouseEvent, rect: GridRect): NormalizedPoint {
  return {
    x: Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)),
    y: Math.max(0, Math.min(1, 1 - (event.clientY - rect.top) / rect.height))
  };
}
