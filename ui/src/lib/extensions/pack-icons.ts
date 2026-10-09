import Box from '@lucide/svelte/icons/box';
import ArrowRightLeft from '@lucide/svelte/icons/arrow-right-left';
import Camera from '@lucide/svelte/icons/camera';
import ChartLine from '@lucide/svelte/icons/chart-line';
import Clock from '@lucide/svelte/icons/clock';
import Palette from '@lucide/svelte/icons/palette';
import Shapes from '@lucide/svelte/icons/shapes';
import AudioLines from '@lucide/svelte/icons/audio-lines';
import AudioWaveform from '@lucide/svelte/icons/audio-waveform';
import SlidersHorizontal from '@lucide/svelte/icons/sliders-horizontal';
import Music from '@lucide/svelte/icons/music';
import Activity from '@lucide/svelte/icons/activity';
import GitBranch from '@lucide/svelte/icons/git-branch';
import Layout from '@lucide/svelte/icons/layout';
import Wifi from '@lucide/svelte/icons/wifi';
import Piano from '@lucide/svelte/icons/piano';
import Brain from '@lucide/svelte/icons/brain';
import Code from '@lucide/svelte/icons/code';
import Cpu from '@lucide/svelte/icons/cpu';
import Eye from '@lucide/svelte/icons/eye';
import FlaskConical from '@lucide/svelte/icons/flask-conical';
import Package from '@lucide/svelte/icons/package';
import Route from '@lucide/svelte/icons/route';
import Calculator from '@lucide/svelte/icons/calculator';
import FileHeadphone from '@lucide/svelte/icons/file-headphone';
import Grid3x3 from '@lucide/svelte/icons/grid-3x3';
import Usb from '@lucide/svelte/icons/usb';
import Waypoints from '@lucide/svelte/icons/waypoints';
import CircuitBoard from '@lucide/svelte/icons/circuit-board';
import ScanSearch from '@lucide/svelte/icons/scan-search';
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
    .with('ChartLine', () => ChartLine)
    .with('Clock', () => Clock)
    .with('Palette', () => Palette)
    .with('Shapes', () => Shapes)
    .with('AudioLines', () => AudioLines)
    .with('AudioWaveform', () => AudioWaveform)
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
    .with('Route', () => Route)
    .with('Calculator', () => Calculator)
    .with('FileHeadphone', () => FileHeadphone)
    .with('Grid3x3', () => Grid3x3)
    .with('Usb', () => Usb)
    .with('Eye', () => Eye)
    .with('Waypoints', () => Waypoints)
    .with('CircuitBoard', () => CircuitBoard)
    .with('ScanSearch', () => ScanSearch)
    .otherwise(() => Package);
}
