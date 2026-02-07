import type { Component } from 'svelte';
import { match } from 'ts-pattern';

import SineWaveIcon from './SineWaveIcon.svelte';
import SquareWaveIcon from './SquareWaveIcon.svelte';
import TriangleWaveIcon from './TriangleWaveIcon.svelte';
import SawtoothWaveIcon from './SawtoothWaveIcon.svelte';
import CustomWaveIcon from './CustomWaveIcon.svelte';

export { SineWaveIcon, SquareWaveIcon, TriangleWaveIcon, SawtoothWaveIcon, CustomWaveIcon };

export type WaveformType = 'sine' | 'square' | 'triangle' | 'sawtooth' | 'custom';

/**
 * Get the waveform icon component for a given oscillator type.
 */
export function getWaveformIcon(waveformType: string | unknown): Component<{ class?: string }> {
  return match(waveformType)
    .with('sine', () => SineWaveIcon)
    .with('square', () => SquareWaveIcon)
    .with('triangle', () => TriangleWaveIcon)
    .with('sawtooth', () => SawtoothWaveIcon)
    .otherwise(() => CustomWaveIcon);
}

/**
 * Get an icon component from an icon identifier string.
 * Format: "category:type" (e.g., "waveform:sine", "waveform:square")
 *
 * @param iconId - Icon identifier in "category:type" format
 * @returns The icon component or undefined if not found
 */
export function getIconById(iconId: string): Component<{ class?: string }> | undefined {
  const [category, type] = iconId.split(':');

  return match(category)
    .with('waveform', () => getWaveformIcon(type))
    .otherwise(() => undefined);
}
