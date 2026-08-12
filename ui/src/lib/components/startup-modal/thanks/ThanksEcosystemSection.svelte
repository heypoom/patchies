<script lang="ts">
  import { ExternalLink } from '@lucide/svelte/icons';

  import { supportLinks } from '$lib/data/license-data';

  import { supportGroups, supportTypeLabels } from './thanks-tab-data';
  import { revealSection } from './thanks-tab-motion';
  import ThanksSectionHeading from './ThanksSectionHeading.svelte';
</script>

<section class="ecosystem-section" {@attach revealSection}>
  <ThanksSectionHeading
    title="Support the source."
    description="If you enjoy Patchies, consider supporting the creators behind the tools and libraries that made it possible."
    split
  />

  <div class="ecosystem-grid">
    {#each supportGroups as group (group.category)}
      <section class="support-channel" {@attach revealSection}>
        <div class="channel-heading">
          <span class="channel-port" aria-hidden="true"></span>
          <h3>{group.title}</h3>
          <p>{group.description}</p>
        </div>

        <div class="support-list">
          {#each supportLinks.filter((item) => item.category === group.category) as creator (creator.name)}
            <a class="support-row" href={creator.url} target="_blank" rel="noopener noreferrer">
              <span class="support-row-main">
                <strong>{creator.name}</strong>
                <small>{creator.description}</small>
                {#if creator.projects}
                  <span class="support-projects">{creator.projects.join(' · ')}</span>
                {/if}
              </span>
              <span class="support-action">
                {supportTypeLabels[creator.type] ?? 'Support'}
                <ExternalLink class="inline-icon" aria-hidden="true" />
              </span>
            </a>
          {/each}
        </div>
      </section>
    {/each}
  </div>
</section>

<style>
  .ecosystem-section {
    position: relative;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    background: #0e0e10;
  }

  .ecosystem-grid {
    display: flex;
    flex-direction: column;
    border-top: 1px solid rgba(255, 255, 255, 0.08);
  }

  .support-channel {
    display: grid;
    min-width: 0;
    grid-template-columns: minmax(220px, 0.72fr) minmax(0, 2.28fr);
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  }

  .support-channel:last-child {
    border-bottom: 0;
  }

  .channel-heading {
    position: sticky;
    top: 0;
    z-index: 1;
    align-self: start;
    min-height: 130px;
    padding: 26px 24px 22px;
    border-right: 1px solid rgba(255, 255, 255, 0.08);
    background: #0e0e10;
  }

  .channel-heading::before {
    position: absolute;
    top: 0;
    bottom: 0;
    left: 27px;
    width: 1px;
    background: rgba(249, 115, 22, 0.28);
    content: '';
  }

  .channel-heading::after {
    position: absolute;
    top: 0;
    left: 25px;
    width: 5px;
    height: 16px;
    border-radius: 9999px;
    background: linear-gradient(180deg, transparent, #fb923c, transparent);
    content: '';
    opacity: 0;
    transform: translateY(0);
  }

  .channel-port {
    position: absolute;
    top: -5px;
    left: 23px;
    z-index: 1;
    width: 9px;
    height: 9px;
    border: 2px solid #0e0e10;
    border-radius: 9999px;
    background: #f97316;
    transition:
      background-color 0.18s ease,
      transform 0.18s ease;
  }

  .channel-heading h3,
  .channel-heading p {
    margin-left: 22px;
  }

  .channel-heading h3 {
    color: #e4e4e7;
    font-family: 'IBM Plex Sans', sans-serif;
    font-size: 0.9rem;
    font-weight: 500;
  }

  .channel-heading p {
    max-width: 34ch;
    margin-top: 8px;
    color: #a1a1aa;
    font-family: 'IBM Plex Sans', sans-serif;
    font-size: 0.7rem;
    line-height: 1.5;
  }

  .support-list {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .support-row {
    position: relative;
    display: flex;
    min-height: 116px;
    align-items: flex-start;
    justify-content: space-between;
    gap: 16px;
    padding: 20px 24px;
    border-right: 1px solid rgba(255, 255, 255, 0.06);
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
    color: inherit;
    text-decoration: none;
    transition: background-color 0.2s ease;
  }

  .support-row::before {
    position: absolute;
    inset: 0;
    background: linear-gradient(100deg, transparent 12%, rgba(249, 115, 22, 0.06), transparent 64%);
    content: '';
    opacity: 0;
    pointer-events: none;
    transform: translateX(-45%);
    transition:
      opacity 0.18s ease,
      transform 0.5s cubic-bezier(0.16, 1, 0.3, 1);
  }

  .support-row:hover {
    background: rgba(249, 115, 22, 0.045);
  }

  .support-row:hover::before {
    opacity: 1;
    transform: translateX(28%);
  }

  .support-row:nth-child(3n) {
    border-right: 0;
  }

  .support-row-main {
    display: flex;
    min-width: 0;
    flex-direction: column;
  }

  .support-row strong {
    color: #d4d4d8;
    font-family: 'IBM Plex Sans', sans-serif;
    font-size: 0.78rem;
    font-weight: 500;
    line-height: 1.35;
  }

  .support-row small {
    margin-top: 6px;
    color: #a1a1aa;
    font-family: 'IBM Plex Sans', sans-serif;
    font-size: 0.68rem;
    line-height: 1.45;
  }

  .support-projects {
    margin-top: 9px;
    color: #71717a;
    font-family: 'IBM Plex Mono', monospace;
    font-size: 0.55rem;
    line-height: 1.45;
  }

  .support-action {
    display: inline-flex;
    flex: 0 0 auto;
    align-items: center;
    gap: 4px;
    color: #a1a1aa;
    font-family: 'IBM Plex Mono', monospace;
    font-size: 0.55rem;
  }

  .support-row:hover :global(.inline-icon) {
    transform: translate(2px, -2px);
  }

  .support-row:focus-visible {
    outline: 2px solid rgba(251, 146, 60, 0.85);
    outline-offset: 3px;
  }

  :global(.inline-icon) {
    width: 11px;
    height: 11px;
    flex: 0 0 auto;
    transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  }

  .support-channel:global(.motion-ready) .channel-heading,
  .support-channel:global(.motion-ready) .support-row {
    opacity: 0;
    transform: translateY(10px);
  }

  .support-channel:global(.motion-ready.is-revealed) .channel-heading {
    animation: channel-resolve 0.6s cubic-bezier(0.16, 1, 0.3, 1) both;
  }

  .support-channel:global(.motion-ready.is-revealed) .support-row {
    animation: detail-resolve 0.48s cubic-bezier(0.16, 1, 0.3, 1) 0.1s both;
  }

  .support-channel:global(.motion-ready.is-revealed) .support-row:nth-child(3n + 2) {
    animation-delay: 0.16s;
  }

  .support-channel:global(.motion-ready.is-revealed) .support-row:nth-child(3n) {
    animation-delay: 0.22s;
  }

  .support-channel:global(.motion-ready.is-active) .channel-heading::after {
    animation: channel-signal 2.4s cubic-bezier(0.45, 0, 0.55, 1) 0.5s infinite;
  }

  .support-channel:hover .channel-port {
    background: #fb923c;
    transform: scale(1.24);
  }

  @keyframes channel-resolve {
    from {
      opacity: 0;
      clip-path: inset(0 0 100% 0);
      transform: translateY(10px);
    }
    to {
      opacity: 1;
      clip-path: inset(0 0 0 0);
      transform: translateY(0);
    }
  }

  @keyframes detail-resolve {
    from {
      opacity: 0;
      transform: translateY(10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  @keyframes channel-signal {
    0%,
    12% {
      opacity: 0;
      transform: translateY(0);
    }
    24% {
      opacity: 1;
    }
    76% {
      opacity: 1;
    }
    88%,
    100% {
      opacity: 0;
      transform: translateY(112px);
    }
  }

  @media (max-width: 800px) {
    .support-channel {
      grid-template-columns: 1fr;
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    }

    .support-channel:last-child {
      border-bottom: 0;
    }

    .channel-heading {
      position: relative;
      top: auto;
      border-right: 0;
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    }

    .support-list {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .support-row:nth-child(3n) {
      border-right: 1px solid rgba(255, 255, 255, 0.06);
    }

    .support-row:nth-child(2n) {
      border-right: 0;
    }
  }

  @media (max-width: 600px) {
    .channel-heading {
      min-height: 112px;
      padding-inline: 20px;
    }

    .channel-heading::before {
      left: 23px;
    }

    .channel-heading::after {
      left: 21px;
    }

    .channel-port {
      left: 19px;
    }

    .support-row {
      min-height: 0;
      padding: 18px 20px;
    }

    .support-list {
      grid-template-columns: 1fr;
    }

    .support-row,
    .support-row:nth-child(2n),
    .support-row:nth-child(3n) {
      border-right: 0;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .support-channel:global(.motion-ready) .channel-heading,
    .support-channel:global(.motion-ready) .support-row,
    .support-channel:global(.motion-ready) .channel-heading::after {
      animation: none;
      opacity: 1;
      clip-path: none;
      transform: none;
      transition: none;
    }
  }
</style>
