import { describe, expect, it, vi } from 'vitest';
import { RotateCcw } from '@lucide/svelte/icons';
import { getObjectPreviewMenuGroups } from './object-preview-menu-actions';

describe('object preview menu actions', () => {
  it('includes extra menu items in the shared top action group', () => {
    const resetCamera = vi.fn();

    const groups = getObjectPreviewMenuGroups({
      onOpenHelp: vi.fn(),
      extraMenuItems: [
        {
          label: 'Reset camera',
          icon: RotateCcw,
          onclick: resetCamera
        }
      ]
    });

    const resetAction = groups
      .find((group) => group.id === 'top')
      ?.actions.find((action) => action.label === 'Reset camera');

    expect(resetAction).toBeDefined();

    resetAction?.onclick({} as MouseEvent);

    expect(resetCamera).toHaveBeenCalledTimes(1);
  });

  it('appends display extra menu items to the display action group', () => {
    const expand = vi.fn();
    const resetCamera = vi.fn();

    const groups = getObjectPreviewMenuGroups({
      onOpenHelp: vi.fn(),
      onExpandToggle: expand,
      displayExtraMenuItems: [
        {
          label: 'Reset camera',
          icon: RotateCcw,
          onclick: resetCamera
        }
      ]
    });

    const displayActions = groups.find((group) => group.id === 'display')?.actions;

    expect(displayActions?.map((action) => action.label)).toEqual(['Expand', 'Reset camera']);

    displayActions?.at(-1)?.onclick({} as MouseEvent);

    expect(resetCamera).toHaveBeenCalledTimes(1);
  });

  it('places save as preset immediately before help without a divider when available', () => {
    const saveAsPreset = vi.fn();
    const openHelp = vi.fn();

    const groups = getObjectPreviewMenuGroups({
      onOpenHelp: openHelp,
      onSaveAsPreset: saveAsPreset
    });

    expect(groups.at(-1)?.actions.map((action) => action.label)).toEqual(['Save preset', 'Help']);

    groups.at(-1)?.actions[0]?.onclick({} as MouseEvent);

    expect(saveAsPreset).toHaveBeenCalledTimes(1);
    expect(openHelp).not.toHaveBeenCalled();
  });
});
