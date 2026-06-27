export const DEFAULT_GROUP_COLOR = '#71717a';

export const GROUP_COLOR_PRESETS = [
  { name: 'Gray', value: DEFAULT_GROUP_COLOR },
  { name: 'Sky', value: '#38bdf8' },
  { name: 'Violet', value: '#8b5cf6' },
  { name: 'Rose', value: '#f43f5e' },
  { name: 'Amber', value: '#f59e0b' },
  { name: 'Emerald', value: '#10b981' },
  { name: 'Cyan', value: '#06b6d4' },
  { name: 'Lime', value: '#84cc16' },
  { name: 'Slate', value: '#94a3b8' },
  { name: 'Indigo', value: '#6366f1' }
] as const;

const HEX_COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;

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

export function getGroupColorPreset(color: string | undefined): { name: string; value: string } {
  if (!color || !HEX_COLOR_PATTERN.test(color)) return GROUP_COLOR_PRESETS[0];

  return (
    GROUP_COLOR_PRESETS.find((preset) => preset.value === color) ?? { name: 'Custom', value: color }
  );
}

export function getGroupTitle(title: string | undefined): string {
  return title?.trim() || 'group';
}

export function getGroupCanResize(canResize: boolean | undefined): boolean {
  return canResize ?? true;
}

export function getGroupIsLocked(locked: boolean | undefined): boolean {
  return locked ?? false;
}

function hexToRgb(hexColor: string): { r: number; g: number; b: number } {
  const normalized = getGroupColorPreset(hexColor).value.slice(1);

  return {
    r: parseInt(normalized.slice(0, 2), 16),
    g: parseInt(normalized.slice(2, 4), 16),
    b: parseInt(normalized.slice(4, 6), 16)
  };
}

function rgba(hexColor: string, alpha: number): string {
  const { r, g, b } = hexToRgb(hexColor);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

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

export function getGroupSettingsPanelClasses(): string {
  return [
    'nodrag',
    'pointer-events-auto',
    'absolute',
    'top-0',
    'left-[calc(100%+0.5rem)]',
    'z-20',
    'w-44',
    'rounded-md',
    'border',
    'border-zinc-700',
    'bg-zinc-900',
    'p-3',
    'shadow-xl'
  ].join(' ');
}

export function getGroupColorGridClasses(): string {
  return 'grid grid-cols-5 gap-2';
}

export function getGroupFrameStyle(width: number, height: number): string {
  return `width: ${width}px; height: ${height}px;`;
}

export function getGroupVisualFrameClasses(selected: boolean): string[] {
  return [
    'pointer-events-none h-full w-full rounded border border-dashed transition-colors',
    selected ? 'shadow-[0_0_0_1px_var(--group-glow-color)]' : ''
  ];
}

export function getGroupVisualFrameStyle(color: string | undefined, selected: boolean): string {
  const resolvedColor = getGroupColorPreset(color).value;
  const borderAlpha = selected ? 0.85 : 0.55;
  const backgroundAlpha = selected ? 0.12 : 0.08;
  const glowAlpha = selected ? 0.35 : 0;

  return [
    `border-color: ${rgba(resolvedColor, borderAlpha)};`,
    `background-color: ${rgba(resolvedColor, backgroundAlpha)};`,
    `--group-glow-color: ${rgba(resolvedColor, glowAlpha)};`
  ].join(' ');
}
