<script lang="ts">
  import { ExternalLink } from '@lucide/svelte/icons';

  import { specialPeople } from './thanks-tab-data';
  import { revealSection } from './thanks-tab-motion';
  import ThanksSectionHeading from './ThanksSectionHeading.svelte';
</script>

<section class="people-section" {@attach revealSection}>
  <ThanksSectionHeading
    title="The people in the patch."
    description="These people helped bring Patchies to life through their guidance."
  />

  <div class="people-grid">
    {#each specialPeople as person, index (person.name)}
      <article class="person-card person-card--{index + 1}" {@attach revealSection}>
        <span class="person-port" aria-hidden="true"></span>
        <p class="person-short">{person.shortName}</p>
        <h3>{person.name}</h3>
        <p class="person-bio">{person.bio}</p>
        {#if person.meta}
          <p class="person-meta">{person.meta}</p>
        {/if}
        {#if person.links.length > 0}
          <div class="person-links">
            {#each person.links as link (link.href)}
              <a href={link.href} target="_blank" rel="noopener noreferrer">
                {link.label}
                <ExternalLink class="inline-icon" aria-hidden="true" />
              </a>
            {/each}
          </div>
        {/if}
      </article>
    {/each}
  </div>
</section>

<style>
  .people-section {
    position: relative;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  }

  .people-grid {
    display: grid;
    grid-template-columns: repeat(12, minmax(0, 1fr));
    border-top: 1px solid rgba(255, 255, 255, 0.08);
  }

  .person-card {
    position: relative;
    min-height: 260px;
    padding: 30px 36px 34px;
    border-right: 1px solid rgba(255, 255, 255, 0.08);
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    background: #111113;
    transition: background-color 0.24s ease;
  }

  .person-card::after {
    position: absolute;
    top: -1px;
    right: 0;
    left: 36px;
    height: 1px;
    background: linear-gradient(90deg, #f97316, rgba(249, 115, 22, 0.12) 72%, transparent);
    content: '';
    opacity: 0;
    transform: scaleX(0);
    transform-origin: left;
  }

  .person-card:hover {
    background: #151517;
  }

  .person-card--1,
  .person-card--4,
  .person-card--5 {
    grid-column: span 7;
  }

  .person-card--2,
  .person-card--3,
  .person-card--6 {
    grid-column: span 5;
  }

  .person-card--2,
  .person-card--4,
  .person-card--6 {
    border-right: 0;
  }

  .person-card--5,
  .person-card--6 {
    border-bottom: 0;
  }

  .person-port {
    position: absolute;
    top: -5px;
    left: 36px;
    width: 9px;
    height: 9px;
    border: 2px solid #111113;
    border-radius: 9999px;
    background: #f97316;
    transition:
      background-color 0.18s ease,
      transform 0.18s ease;
  }

  .person-port::after {
    position: absolute;
    inset: -5px;
    border: 1px solid rgba(249, 115, 22, 0.55);
    border-radius: inherit;
    content: '';
    opacity: 0;
    transform: scale(0.45);
  }

  .person-card:hover .person-port {
    background: #fb923c;
    transform: scale(1.28);
  }

  .person-short {
    margin-bottom: 30px;
    color: #f97316;
    font-family: 'IBM Plex Mono', monospace;
    font-size: 0.68rem;
    letter-spacing: 0.12em;
    text-transform: uppercase;
  }

  .person-card h3 {
    max-width: 24ch;
    color: #e4e4e7;
    font-family: 'IBM Plex Sans', sans-serif;
    font-size: 1.18rem;
    font-weight: 500;
    line-height: 1.3;
  }

  .person-bio {
    max-width: 64ch;
    margin-top: 12px;
    color: #a1a1aa;
    font-family: 'IBM Plex Sans', sans-serif;
    font-size: 0.8rem;
    line-height: 1.65;
  }

  .person-meta {
    margin-top: 14px;
    color: #a1a1aa;
    font-family: 'IBM Plex Mono', monospace;
    font-size: 0.6rem;
    line-height: 1.55;
  }

  .person-links {
    display: flex;
    flex-wrap: wrap;
    gap: 8px 14px;
    margin-top: 18px;
  }

  .person-links a {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    color: #a1a1aa;
    font-family: 'IBM Plex Mono', monospace;
    font-size: 0.65rem;
    text-decoration: none;
    transition:
      color 0.15s ease,
      transform 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  }

  .person-links a:hover {
    color: #fb923c;
    transform: translateX(2px);
  }

  .person-links a:hover :global(.inline-icon) {
    transform: translate(2px, -2px);
  }

  .person-links a:focus-visible {
    outline: 2px solid rgba(251, 146, 60, 0.85);
    outline-offset: 3px;
  }

  :global(.inline-icon) {
    width: 11px;
    height: 11px;
    flex: 0 0 auto;
    transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  }

  .person-card:global(.motion-ready) {
    opacity: 0;
    clip-path: inset(0 0 18% 0);
    transform: translateY(14px);
  }

  .person-card:global(.motion-ready) > :not(.person-port) {
    opacity: 0;
    transform: translateY(8px);
  }

  .person-card:global(.motion-ready) .person-port {
    opacity: 0;
    transform: scale(0.35);
  }

  .person-card:global(.motion-ready.is-revealed) {
    animation: patch-node-connect 0.44s cubic-bezier(0.16, 1, 0.3, 1) both;
  }

  .person-card:global(.motion-ready.is-revealed):nth-child(even) {
    animation-delay: 0.04s;
  }

  .person-card:global(.motion-ready.is-revealed) > :not(.person-port) {
    animation: node-content-resolve 0.34s cubic-bezier(0.16, 1, 0.3, 1) 0.1s both;
  }

  .person-card:global(.motion-ready.is-revealed) .person-port {
    animation: port-connect 0.3s cubic-bezier(0.16, 1, 0.3, 1) 0.06s both;
  }

  .person-card:global(.motion-ready.is-revealed)::after {
    animation: connection-draw 0.54s cubic-bezier(0.16, 1, 0.3, 1) 0.1s both;
  }

  .person-card:global(.motion-ready.is-active.is-revealed) .person-port::after {
    animation: port-ping 2.6s ease-out 0.8s infinite;
  }

  @keyframes patch-node-connect {
    from {
      opacity: 0;
      clip-path: inset(0 0 18% 0);
      transform: translateY(14px);
    }
    to {
      opacity: 1;
      clip-path: inset(0 0 0 0);
      transform: translateY(0);
    }
  }

  @keyframes node-content-resolve {
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  @keyframes port-connect {
    0% {
      opacity: 0;
      transform: scale(0.35);
    }
    65% {
      opacity: 1;
      transform: scale(1.35);
    }
    100% {
      opacity: 1;
      transform: scale(1);
    }
  }

  @keyframes port-ping {
    0%,
    72% {
      opacity: 0;
      transform: scale(0.45);
    }
    82% {
      opacity: 0.8;
    }
    100% {
      opacity: 0;
      transform: scale(1.4);
    }
  }

  @keyframes connection-draw {
    from {
      opacity: 0;
      transform: scaleX(0);
    }
    to {
      opacity: 1;
      transform: scaleX(1);
    }
  }

  @media (max-width: 800px) {
    .people-grid {
      grid-template-columns: 1fr;
    }

    .person-card,
    .person-card--1,
    .person-card--2,
    .person-card--3,
    .person-card--4,
    .person-card--5,
    .person-card--6 {
      grid-column: auto;
      border-right: 0;
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    }

    .person-card:last-child {
      border-bottom: 0;
    }
  }

  @media (max-width: 600px) {
    .person-card {
      min-height: 0;
      padding: 28px 20px 30px;
    }

    .person-port,
    .person-card::after {
      left: 20px;
    }

    .person-short {
      margin-bottom: 20px;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .person-card:global(.motion-ready),
    .person-card:global(.motion-ready) > :not(.person-port),
    .person-card:global(.motion-ready) .person-port,
    .person-card:global(.motion-ready)::after,
    .person-card:global(.motion-ready) .person-port::after {
      animation: none;
      opacity: 1;
      clip-path: none;
      transform: none;
      transition: none;
    }
  }
</style>
