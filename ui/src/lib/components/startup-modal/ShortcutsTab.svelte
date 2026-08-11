<script lang="ts">
  import { Box, MousePointer, Play, Save } from '@lucide/svelte/icons';
  import { onMount } from 'svelte';

  import { isAiFeaturesVisible } from '../../../stores/ui.store';

  let isMac = $state(false);

  onMount(() => {
    isMac = /Mac|iPhone|iPad|iPod/.test(navigator.userAgent);
  });

  interface Shortcut {
    keys: string[];
    description: string;
    requiresAi?: boolean;
  }

  const shortcutGroups = [
    {
      id: 'canvas',
      title: 'Canvas & selection',
      description: 'Navigate the patch and choose what to work on.',
      icon: MousePointer,
      shortcuts: [
        { keys: ['Click object or title'], description: 'Focus object' },
        { keys: ['Drag object or title'], description: 'Move object' },
        { keys: ['Scroll up'], description: 'Zoom in' },
        { keys: ['Scroll down'], description: 'Zoom out' },
        { keys: ['Drag empty canvas'], description: 'Pan canvas' },
        { keys: ['Shift', 'Drag empty canvas'], description: 'Box-select objects' },
        { keys: ['Shift', 'Click object or edge'], description: 'Add to selection' }
      ] satisfies Shortcut[]
    },
    {
      id: 'create',
      title: 'Create & edit',
      description: 'Add objects and change the selected content.',
      icon: Box,
      shortcuts: [
        { keys: ['Enter'], description: 'Create object at cursor' },
        { keys: ['Ctrl', 'O'], description: 'Browse all objects' },
        {
          keys: ['Ctrl', 'I'],
          description: 'Insert or edit with AI',
          requiresAi: true
        },
        { keys: ['Delete'], description: 'Delete selection' },
        { keys: ['Ctrl', 'C'], description: 'Copy selection' },
        { keys: ['Ctrl', 'V'], description: 'Paste copied objects' }
      ] satisfies Shortcut[]
    },
    {
      id: 'patch',
      title: 'Patch & workspace',
      description: 'Manage files, history, and the editor workspace.',
      icon: Save,
      shortcuts: [
        { keys: ['Ctrl', 'K'], description: 'Command palette' },
        { keys: ['Ctrl', 'B'], description: 'Toggle sidebar' },
        { keys: ['Ctrl', 'S'], description: 'Save patch' },
        { keys: ['Ctrl', 'Shift', 'S'], description: 'Save as new patch' },
        { keys: ['Ctrl', 'N'], description: 'Create new patch' },
        { keys: ['Ctrl', 'Z'], description: 'Undo' },
        { keys: ['Ctrl', 'Shift', 'Z'], description: 'Redo' }
      ] satisfies Shortcut[]
    },
    {
      id: 'playback',
      title: 'Run & playback',
      description: 'Execute code and control the live patch.',
      icon: Play,
      shortcuts: [
        { keys: ['Shift', 'Enter'], description: 'Run editor code' },
        { keys: ['Space'], description: 'Play or pause' },
        { keys: ['Shift', 'Space'], description: 'Toggle transport panel' },
        { keys: ['Shift', 'P'], description: 'Toggle node previews' }
      ] satisfies Shortcut[]
    }
  ];

  const transformKey = (key: string) => (isMac && key === 'Ctrl' ? 'Cmd' : key);

  const visibleGroups = $derived(
    shortcutGroups.map((group) => ({
      ...group,
      shortcuts: group.shortcuts.filter((shortcut) => !shortcut.requiresAi || $isAiFeaturesVisible)
    }))
  );

  const shortcutCount = $derived(
    visibleGroups.reduce((total, group) => total + group.shortcuts.length, 0)
  );
</script>

<div class="sc-root">
  <header class="sc-intro">
    <div>
      <h1>Move at patch speed.</h1>
      <p>Keyboard and mouse controls, organized around the work you want to do.</p>
    </div>
    <div class="sc-intro-meta" aria-label={`${shortcutCount} documented controls`}>
      <span>{shortcutCount} controls</span>
    </div>
  </header>

  <div class="sc-sections">
    {#each visibleGroups as group (group.id)}
      {@const GroupIcon = group.icon}
      <section class="sc-group" aria-labelledby="sc-{group.id}">
        <header class="sc-group-heading">
          <div class="sc-group-title">
            <GroupIcon class="sc-group-icon" aria-hidden="true" />
            <div>
              <h2 id="sc-{group.id}">{group.title}</h2>
              <p>{group.description}</p>
            </div>
          </div>
          <span>{group.shortcuts.length}</span>
        </header>

        <ul class="sc-list">
          {#each group.shortcuts as shortcut (shortcut.description)}
            <li class="sc-row">
              <span class="sc-desc">{shortcut.description}</span>
              <span class="sc-keys" aria-label={shortcut.keys.map(transformKey).join(' plus ')}>
                {#each shortcut.keys as key (key)}
                  <kbd class="sc-key">{transformKey(key)}</kbd>
                {/each}
              </span>
            </li>
          {/each}
        </ul>
      </section>
    {/each}
  </div>
</div>

<style>
  .sc-root {
    min-height: 100%;
    background: #101012;
  }

  .sc-intro {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 32px;
    padding: 26px 34px 24px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  }

  .sc-intro h1 {
    color: #f4f4f5;
    font-family: 'IBM Plex Sans', sans-serif;
    font-size: clamp(2.25rem, 5vw, 3.35rem);
    font-weight: 400;
    line-height: 0.98;
    letter-spacing: -0.035em;
    text-wrap: balance;
  }

  .sc-intro p {
    max-width: 60ch;
    margin-top: 9px;
    color: #a1a1aa;
    font-family: 'IBM Plex Sans', sans-serif;
    font-size: 0.82rem;
    line-height: 1.5;
  }

  .sc-intro-meta {
    display: flex;
    flex: 0 0 auto;
    flex-direction: column;
    align-items: flex-end;
    gap: 5px;
    padding-bottom: 2px;
    color: #a1a1aa;
    font-family: 'IBM Plex Mono', monospace;
    font-size: 0.62rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .sc-sections {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .sc-group {
    min-width: 0;
    border-right: 1px solid rgba(255, 255, 255, 0.08);
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  }

  .sc-group:nth-child(2n) {
    border-right: 0;
  }

  .sc-group-heading {
    display: flex;
    min-height: 76px;
    align-items: flex-start;
    justify-content: space-between;
    gap: 20px;
    padding: 18px 22px 16px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.07);
    background: #121214;
  }

  .sc-group-title {
    display: flex;
    min-width: 0;
    align-items: flex-start;
    gap: 10px;
  }

  :global(.sc-group-icon) {
    width: 15px;
    height: 15px;
    flex: 0 0 auto;
    margin-top: 2px;
    color: #f97316;
    stroke-width: 1.7;
  }

  .sc-group-heading h2 {
    color: #e4e4e7;
    font-family: 'IBM Plex Sans', sans-serif;
    font-size: 0.88rem;
    font-weight: 500;
    line-height: 1.3;
  }

  .sc-group-heading p {
    max-width: 38ch;
    margin-top: 4px;
    color: #a1a1aa;
    font-family: 'IBM Plex Sans', sans-serif;
    font-size: 0.66rem;
    line-height: 1.4;
  }

  .sc-group-heading > span {
    flex: 0 0 auto;
    color: #71717a;
    font-family: 'IBM Plex Mono', monospace;
    font-size: 0.62rem;
  }

  .sc-list {
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .sc-row {
    display: grid;
    min-height: 48px;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: center;
    gap: 14px;
    padding: 9px 18px 9px 22px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.055);
  }

  .sc-row:last-child {
    border-bottom: 0;
  }

  .sc-desc {
    min-width: 0;
    color: #a1a1aa;
    font-family: 'IBM Plex Sans', sans-serif;
    font-size: 0.74rem;
    line-height: 1.35;
  }

  .sc-keys {
    display: inline-flex;
    min-width: 0;
    align-items: center;
    justify-content: flex-end;
    gap: 4px;
  }

  .sc-key {
    padding: 3px 7px;
    border: 1px solid rgba(255, 255, 255, 0.14);
    border-radius: 4px;
    background: #1c1c1f;
    color: #b4b4bc;
    font-family: 'IBM Plex Mono', monospace;
    font-size: 0.61rem;
    line-height: 1.25;
    white-space: nowrap;
  }

  @media (max-width: 780px) {
    .sc-sections {
      grid-template-columns: 1fr;
    }

    .sc-group {
      border-right: 0;
    }
  }

  @media (max-width: 600px) {
    .sc-intro {
      align-items: flex-start;
      flex-direction: column;
      gap: 16px;
      padding: 24px 20px 22px;
    }

    .sc-intro h1 {
      font-size: clamp(2.1rem, 11vw, 2.75rem);
    }

    .sc-intro-meta {
      flex-direction: row;
      align-items: center;
      gap: 12px;
    }

    .sc-group-heading {
      padding-inline: 20px;
    }

    .sc-row {
      gap: 12px;
      padding-inline: 20px;
    }
  }

  @media (max-width: 360px) {
    .sc-row {
      padding-inline: 16px;
    }

    .sc-key {
      padding-inline: 5px;
      font-size: 0.56rem;
    }
  }
</style>
