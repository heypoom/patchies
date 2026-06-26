export const GROUP_BORDER_HIT_ZONES = [
  {
    id: 'top',
    ariaLabel: 'Select group top border',
    className: 'pointer-events-auto absolute top-0 right-0 left-0 h-3 cursor-move'
  },
  {
    id: 'right',
    ariaLabel: 'Select group right border',
    className: 'pointer-events-auto absolute top-3 right-0 bottom-3 w-3 cursor-move'
  },
  {
    id: 'bottom',
    ariaLabel: 'Select group bottom border',
    className: 'pointer-events-auto absolute right-0 bottom-0 left-0 h-3 cursor-move'
  },
  {
    id: 'left',
    ariaLabel: 'Select group left border',
    className: 'pointer-events-auto absolute top-3 bottom-3 left-0 w-3 cursor-move'
  }
] as const;

export function getGroupTitleClasses(): string {
  return [
    'node-title-drag-handle',
    'pointer-events-auto',
    'absolute',
    '-top-7',
    'left-0',
    'z-10',
    'w-fit',
    'cursor-move',
    'rounded-lg',
    'bg-zinc-900',
    'px-2',
    'py-1'
  ].join(' ');
}

export function getGroupVisualFrameClasses(selected: boolean): string[] {
  return [
    'pointer-events-none h-full w-full rounded border border-dashed bg-zinc-500/6 transition-colors',
    selected
      ? 'border-sky-300/80 bg-sky-500/8 shadow-[0_0_0_1px_rgba(125,211,252,0.35)]'
      : 'border-zinc-500/70'
  ];
}
