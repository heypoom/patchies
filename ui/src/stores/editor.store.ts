import { writable } from 'svelte/store';

export const useVimInEditor = writable(localStorage.getItem('editor.vim') === 'true');
