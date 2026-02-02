import {
  Box,
  ArrowRightLeft,
  Camera,
  Palette,
  Shapes,
  AudioLines,
  SlidersHorizontal,
  Music,
  Activity,
  GitBranch,
  Layout,
  Wifi,
  Piano,
  Brain,
  Code,
  Cpu,
  FlaskConical,
  Package
} from '@lucide/svelte/icons';
import { match } from 'ts-pattern';

/**
 * Maps icon names from BUILT_IN_PACKS to lucide components.
 * Used by ExtensionPackCard and ObjectBrowserModal.
 */
export function getPackIcon(iconName: string) {
  return match(iconName)
    .with('Box', () => Box)
    .with('ArrowRightLeft', () => ArrowRightLeft)
    .with('Camera', () => Camera)
    .with('Palette', () => Palette)
    .with('Shapes', () => Shapes)
    .with('AudioLines', () => AudioLines)
    .with('SlidersHorizontal', () => SlidersHorizontal)
    .with('Music', () => Music)
    .with('Activity', () => Activity)
    .with('GitBranch', () => GitBranch)
    .with('Layout', () => Layout)
    .with('Wifi', () => Wifi)
    .with('Piano', () => Piano)
    .with('Brain', () => Brain)
    .with('Code', () => Code)
    .with('Cpu', () => Cpu)
    .with('FlaskConical', () => FlaskConical)
    .otherwise(() => Package);
}
