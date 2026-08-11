<script lang="ts">
  import { BookOpen, Github, Instagram, MessageCircle } from '@lucide/svelte/icons';

  import { showStartupModalOnLoad } from '../../../stores/startup-modal.store';

  function toggleShowOnStartup() {
    showStartupModalOnLoad.update((value) => !value);
  }
</script>

<footer class="about-footer">
  <nav class="footer-links" aria-label="Patchies links">
    <a href="/docs/adding-objects" target="_blank" rel="noopener noreferrer" class="footer-link">
      <BookOpen class="h-3.5 w-3.5" />
      docs
    </a>

    <a
      href="https://github.com/heypoom/patchies"
      target="_blank"
      rel="noopener noreferrer"
      class="footer-link"
    >
      <Github class="h-3.5 w-3.5" />
      github
    </a>

    <a
      href="https://www.instagram.com/patchiesapp"
      target="_blank"
      rel="noopener noreferrer"
      class="footer-link"
    >
      <Instagram class="h-3.5 w-3.5" />
      insta
    </a>

    <a
      href="https://discord.gg/PpccRb2XjE"
      target="_blank"
      rel="noopener noreferrer"
      class="footer-link"
    >
      <MessageCircle class="h-3.5 w-3.5" />
      discord
    </a>
  </nav>

  <div class="startup-preference">
    <span>show on startup</span>
    <button
      onclick={toggleShowOnStartup}
      class={['toggle shrink-0', $showStartupModalOnLoad && 'toggle--on']}
      role="switch"
      aria-checked={$showStartupModalOnLoad}
      aria-label="Show startup modal on launch"
    >
      <span class={['toggle-thumb', $showStartupModalOnLoad && 'toggle-thumb--on']}></span>
    </button>
  </div>
</footer>

<style>
  .about-footer {
    position: relative;
    z-index: 2;
    display: flex;
    min-height: 52px;
    flex-shrink: 0;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    border-top: 1px solid rgba(255, 255, 255, 0.08);
    background: #0e0e10;
    padding: 10px 22px;
  }

  .footer-links {
    display: flex;
    min-width: 0;
    align-items: center;
    gap: 14px;
  }

  .footer-link {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    border: 0;
    background: transparent;
    padding: 4px 0;
    color: #a1a1aa;
    font-family: 'IBM Plex Mono', monospace;
    font-size: 0.625rem;
    letter-spacing: 0.04em;
    text-decoration: none;
    transition: color 0.15s ease;
  }

  .footer-link:hover {
    color: #f4f4f5;
  }

  .footer-link:focus-visible,
  .toggle:focus-visible {
    outline: 2px solid rgba(251, 146, 60, 0.8);
    outline-offset: 2px;
  }

  .startup-preference {
    display: flex;
    flex-shrink: 0;
    align-items: center;
    gap: 7px;
    color: #a1a1aa;
    font-family: 'IBM Plex Mono', monospace;
    font-size: 0.625rem;
    letter-spacing: 0.05em;
    white-space: nowrap;
  }

  .toggle {
    position: relative;
    display: inline-flex;
    width: 34px;
    height: 20px;
    flex-shrink: 0;
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 999px;
    background: #27272a;
    cursor: pointer;
    transition:
      background 0.2s ease,
      border-color 0.2s ease;
  }

  .toggle--on {
    border-color: rgba(249, 115, 22, 0.5);
    background: rgba(249, 115, 22, 0.28);
  }

  .toggle-thumb {
    position: absolute;
    top: 2px;
    left: 2px;
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: #71717a;
    transition:
      transform 0.2s ease,
      background 0.2s ease;
  }

  .toggle-thumb--on {
    transform: translateX(14px);
    background: #f97316;
  }

  @media (max-width: 520px) {
    .about-footer {
      min-height: 78px;
      flex-direction: column;
      align-items: stretch;
      gap: 7px;
      padding: 8px 14px 10px;
    }

    .footer-links {
      justify-content: space-between;
      gap: 8px;
    }

    .startup-preference {
      justify-content: flex-end;
    }
  }
</style>
