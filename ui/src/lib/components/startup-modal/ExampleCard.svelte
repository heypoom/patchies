<script lang="ts">
  import type { ExamplePatch } from './types';

  let { patch, onLoad }: { patch: ExamplePatch; onLoad: (id: string) => void } = $props();
</script>

<button onclick={() => onLoad(patch.id)} class="ex-card">
  <span class="ex-corner ex-tl" aria-hidden="true"></span>
  <span class="ex-corner ex-br" aria-hidden="true"></span>

  <h3 class="ex-title">{patch.name}</h3>

  {#if patch.description}
    <p class="ex-desc">{patch.description}</p>
  {/if}

  <div class="ex-footer">
    {#if patch.author}
      <span class="ex-author">{patch.author}</span>
    {/if}
    <span class="ex-cta">open ↗</span>
  </div>
</button>

<style>
  .ex-card {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 14px 16px 12px;
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid rgba(255, 255, 255, 0.07);
    border-radius: 8px;
    text-align: left;
    cursor: pointer;
    transition:
      border-color 0.18s,
      background 0.18s;
    overflow: hidden;
  }

  .ex-card:hover {
    border-color: rgba(249, 115, 22, 0.3);
    background: rgba(249, 115, 22, 0.04);
  }

  .ex-card:hover .ex-corner {
    opacity: 0.6;
  }

  .ex-card:hover .ex-cta {
    color: #f97316;
  }

  /* Corner ornaments */
  .ex-corner {
    position: absolute;
    width: 8px;
    height: 8px;
    opacity: 0.2;
    pointer-events: none;
    transition: opacity 0.18s;
  }

  .ex-tl {
    top: 5px;
    left: 5px;
    border-top: 1px solid #f97316;
    border-left: 1px solid #f97316;
  }

  .ex-br {
    bottom: 5px;
    right: 5px;
    border-bottom: 1px solid #f97316;
    border-right: 1px solid #f97316;
  }

  .ex-title {
    font-family: 'Syne', sans-serif;
    font-size: 0.85rem;
    font-weight: 600;
    color: #d4d4d8;
    line-height: 1.3;
    transition: color 0.15s;
  }

  .ex-card:hover .ex-title {
    color: #f4f4f5;
  }

  .ex-desc {
    font-family: 'Syne', sans-serif;
    font-size: 0.75rem;
    color: #52525b;
    line-height: 1.5;
  }

  .ex-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-top: 2px;
  }

  .ex-author {
    font-family: 'IBM Plex Mono', monospace;
    font-size: 9px;
    color: #3f3f46;
    letter-spacing: 0.05em;
  }

  .ex-cta {
    font-family: 'IBM Plex Mono', monospace;
    font-size: 9px;
    color: #3f3f46;
    letter-spacing: 0.1em;
    transition: color 0.15s;
    margin-left: auto;
  }
</style>
