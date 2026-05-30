import { match } from 'ts-pattern';

type EdgeVisualType = 'audio' | 'video' | 'message';

interface StandardEdgeClassOptions {
  type: EdgeVisualType;
  selected: boolean;
  isBackgroundOutputCanvasEnabled: boolean;
}

export function getStandardEdgeClass({
  type,
  selected,
  isBackgroundOutputCanvasEnabled
}: StandardEdgeClassOptions): Array<string | false> {
  const baseClass = selected
    ? '!stroke-yellow-300'
    : match(type)
        .with('audio', () => '!stroke-blue-400')
        .with('video', () => '!stroke-orange-400')
        .with('message', () => '!stroke-zinc-200')
        .exhaustive();

  const deselectedClass = match(type)
    .with('message', () => 'opacity-60')
    .otherwise(() => 'opacity-90');

  const strokeStyle = match([selected, isBackgroundOutputCanvasEnabled])
    .with([true, true], () => '!stroke-[2px] opacity-100')
    .with([false, true], () => '!stroke-[2px] opacity-80')
    .with([true, false], () => '!stroke-[1.5px]')
    .otherwise(() => '!stroke-[0.7px]');

  return [baseClass, selected && 'edge-selected-glow', !selected && deselectedClass, strokeStyle];
}
