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

export const getGroupTitle = (title: string | undefined): string => title?.trim() || 'group';

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
