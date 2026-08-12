<script lang="ts">
  import { Heart } from '@lucide/svelte/icons';

  import { dependenciesSection, portedCode, supportLinks } from '$lib/data/license-data';

  import { specialPeople } from './thanks-tab-data';
  import { revealSection } from './thanks-tab-motion';
</script>

<section class="credits-hero" {@attach revealSection}>
  <div class="hero-copy">
    <Heart class="hero-heart" strokeWidth={1.5} aria-hidden="true" />
    <h1>Made with <span>love.</span></h1>
    <p>Built upon amazing open source projects and the kindness of many people.</p>
  </div>

  <div class="collective-field">
    <p class="collective-statement">No patch<br />is made <span>alone.</span></p>
    <div class="credits-index">
      <div class="credits-index-row">
        <div>
          <p class="credits-index-title">People in the patch</p>
          <p class="credits-index-copy">
            Playtesting, workshops, technical guidance and encouragement.
          </p>
        </div>
        <span>{specialPeople.length} awesome friends</span>
      </div>
      <div class="credits-index-row">
        <div>
          <p class="credits-index-title">The open-source ecosystem</p>
          <p class="credits-index-copy">
            Libraries, tools, teachers, references and infrastructure.
          </p>
        </div>
        <span>{supportLinks.length} creators &amp; projects</span>
      </div>
      <div class="credits-index-row">
        <div>
          <p class="credits-index-title">Open source</p>
          <p class="credits-index-copy">AGPL 3.0 license, adapted code and libraries we use.</p>
        </div>
        <span>
          {portedCode.length} adapted · {dependenciesSection.dependencies.length} dependencies
        </span>
      </div>
    </div>
  </div>
</section>

<style>
  .credits-hero {
    display: grid;
    min-height: 340px;
    grid-template-columns: minmax(0, 0.8fr) minmax(440px, 1.2fr);
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    background: #0b0b0d;
  }

  .hero-copy {
    position: relative;
    z-index: 1;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    justify-content: center;
    padding: 48px 20px 48px 44px;
  }

  :global(.hero-heart) {
    width: 24px;
    height: 24px;
    margin-bottom: 28px;
    color: #f97316;
  }

  .hero-copy h1 {
    max-width: 8ch;
    color: #f4f4f5;
    font-family: 'IBM Plex Sans', sans-serif;
    font-size: clamp(3.25rem, 7vw, 5.5rem);
    font-weight: 400;
    line-height: 0.9;
    letter-spacing: -0.04em;
    text-wrap: balance;
  }

  .hero-copy h1 span {
    color: #f97316;
  }

  .hero-copy p {
    max-width: 34ch;
    margin-top: 24px;
    color: #a1a1aa;
    font-family: 'IBM Plex Sans', sans-serif;
    font-size: 0.9rem;
    line-height: 1.6;
  }

  .collective-field {
    position: relative;
    display: flex;
    min-height: 340px;
    flex-direction: column;
    justify-content: space-between;
    overflow: hidden;
    padding: 44px 42px 0;
    border-left: 1px solid rgba(255, 255, 255, 0.07);
    background: #0e0e10;
  }

  .collective-statement {
    padding-bottom: 44px;
    color: #e4e4e7;
    font-family: 'IBM Plex Sans', sans-serif;
    font-size: clamp(2.1rem, 4.2vw, 3.45rem);
    font-weight: 400;
    line-height: 0.98;
    letter-spacing: -0.035em;
  }

  .collective-statement span {
    color: #f97316;
  }

  .credits-index {
    margin-inline: -42px;
    border-top: 1px solid rgba(255, 255, 255, 0.09);
  }

  .credits-index-row {
    position: relative;
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: end;
    gap: 28px;
    padding: 14px 42px 15px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.07);
  }

  .credits-index-title {
    color: #d4d4d8;
    font-family: 'IBM Plex Sans', sans-serif;
    font-size: 0.8rem;
    font-weight: 500;
    line-height: 1.35;
  }

  .credits-index-copy {
    max-width: 54ch;
    margin-top: 4px;
    color: #a1a1aa;
    font-family: 'IBM Plex Sans', sans-serif;
    font-size: 0.66rem;
    line-height: 1.45;
  }

  .credits-index-row > span {
    color: #71717a;
    font-family: 'IBM Plex Mono', monospace;
    font-size: 0.57rem;
    line-height: 1.4;
    text-align: right;
  }

  .credits-hero:global(.motion-ready) :global(.hero-heart),
  .credits-hero:global(.motion-ready) .hero-copy h1,
  .credits-hero:global(.motion-ready) .hero-copy p,
  .credits-hero:global(.motion-ready) .collective-statement,
  .credits-hero:global(.motion-ready) .credits-index-row {
    opacity: 0;
  }

  .credits-hero:global(.motion-ready) .hero-copy h1,
  .credits-hero:global(.motion-ready) .collective-statement {
    clip-path: inset(0 0 100% 0);
    transform: translateY(16px);
  }

  .credits-hero:global(.motion-ready) .hero-copy p,
  .credits-hero:global(.motion-ready) .credits-index-row {
    transform: translateY(10px);
  }

  .credits-hero:global(.motion-ready.is-revealed) :global(.hero-heart) {
    animation: heart-arrive 0.72s cubic-bezier(0.16, 1, 0.3, 1) 0.06s both;
  }

  .credits-hero:global(.motion-ready.is-active.is-revealed) :global(.hero-heart) {
    animation:
      heart-arrive 0.72s cubic-bezier(0.16, 1, 0.3, 1) 0.06s both,
      heart-current 2.8s ease-in-out 1s infinite;
  }

  .credits-hero:global(.motion-ready) :global(.hero-heart path) {
    stroke-dasharray: 72;
    stroke-dashoffset: 72;
  }

  .credits-hero:global(.motion-ready.is-revealed) :global(.hero-heart path) {
    animation: draw-heart 0.9s cubic-bezier(0.16, 1, 0.3, 1) 0.12s both;
  }

  .credits-hero:global(.motion-ready.is-revealed) .hero-copy h1 {
    animation: copy-resolve 0.8s cubic-bezier(0.16, 1, 0.3, 1) 0.12s both;
  }

  .credits-hero:global(.motion-ready.is-revealed) .hero-copy p {
    animation: detail-resolve 0.58s cubic-bezier(0.16, 1, 0.3, 1) 0.3s both;
  }

  .credits-hero:global(.motion-ready.is-revealed) .collective-statement {
    animation: copy-resolve 0.72s cubic-bezier(0.16, 1, 0.3, 1) 0.24s both;
  }

  .credits-hero:global(.motion-ready.is-revealed) .credits-index-row {
    animation: detail-resolve 0.52s cubic-bezier(0.16, 1, 0.3, 1) both;
  }

  .credits-hero:global(.motion-ready.is-revealed) .credits-index-row:nth-child(1) {
    animation-delay: 0.38s;
  }

  .credits-hero:global(.motion-ready.is-revealed) .credits-index-row:nth-child(2) {
    animation-delay: 0.46s;
  }

  .credits-hero:global(.motion-ready.is-revealed) .credits-index-row:nth-child(3) {
    animation-delay: 0.54s;
  }

  @keyframes heart-arrive {
    from {
      opacity: 0;
      filter: brightness(1.8);
      transform: rotate(-12deg) scale(0.5);
    }
    to {
      opacity: 1;
      filter: brightness(1);
      transform: rotate(0) scale(1);
    }
  }

  @keyframes heart-current {
    0%,
    72%,
    100% {
      filter: brightness(1);
      transform: scale(1);
    }
    78% {
      filter: brightness(1.35);
      transform: scale(1.12);
    }
    84% {
      filter: brightness(1.08);
      transform: scale(1.04);
    }
    90% {
      filter: brightness(1.28);
      transform: scale(1.1);
    }
  }

  @keyframes draw-heart {
    to {
      stroke-dashoffset: 0;
    }
  }

  @keyframes copy-resolve {
    from {
      opacity: 0;
      clip-path: inset(0 0 100% 0);
      transform: translateY(16px);
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

  @media (max-width: 800px) {
    .credits-hero {
      grid-template-columns: 1fr;
    }

    .hero-copy {
      min-height: 320px;
      padding: 44px 32px;
    }

    .collective-field {
      display: none;
    }
  }

  @media (max-width: 600px) {
    .hero-copy {
      min-height: 300px;
      padding: 36px 20px;
    }

    :global(.hero-heart) {
      margin-bottom: 22px;
    }

    .hero-copy h1 {
      font-size: clamp(3rem, 17vw, 4.5rem);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .credits-hero:global(.motion-ready) :global(.hero-heart),
    .credits-hero:global(.motion-ready) :global(.hero-heart path),
    .credits-hero:global(.motion-ready) .hero-copy h1,
    .credits-hero:global(.motion-ready) .hero-copy p,
    .credits-hero:global(.motion-ready) .collective-statement,
    .credits-hero:global(.motion-ready) .credits-index-row {
      animation: none;
      opacity: 1;
      clip-path: none;
      stroke-dashoffset: 0;
      transform: none;
      transition: none;
    }
  }
</style>
