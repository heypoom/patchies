import { BUILT_IN_PACKS } from '$lib/extensions/object-packs';

export interface Mood {
  id: string;
  name: string;
  tagline: string;
  description: string;
  nodes: string[];
  gradient: string;
  accentColor: string;
  glowColor: string;
  textColor: string;
}

export interface Output {
  id: string;
  name: string;
  description: string;
  packIds?: string[];
  nodes?: string[];
}

export interface Vision {
  title: string;
  vision: string;
  nodes: string[];
}

export function resolveNodes(output: Output): string[] {
  const fromPacks = (output.packIds ?? []).flatMap(
    (packId) => BUILT_IN_PACKS.find((p) => p.id === packId)?.objects ?? []
  );
  return [...new Set([...fromPacks, ...(output.nodes ?? [])])];
}
