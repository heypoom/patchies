import { writable } from 'svelte/store';

const STORAGE_KEY = 'patchies-show-startup-modal';

function load(): boolean {
  if (typeof localStorage === 'undefined') return true;
  return localStorage.getItem(STORAGE_KEY) !== 'false';
}

export const showStartupModalOnLoad = writable(load());

showStartupModalOnLoad.subscribe((value) => {
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, String(value));
  }
});
