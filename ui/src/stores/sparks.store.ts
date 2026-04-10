import { writable } from 'svelte/store';

export interface SparksMoodTheme {
  accentColor: string;
  glowColor: string;
  textColor: string;
}

export const DEFAULT_THEME: SparksMoodTheme = {
  accentColor: '#f97316',
  glowColor: 'rgba(249,115,22,0.06)',
  textColor: '#fed7aa'
};

export const sparksMoodTheme = writable<SparksMoodTheme>(DEFAULT_THEME);
export const sparksSelectedMoodId = writable<string | null>(null);
