<script lang="ts">
  let {
    title,
    description,
    split = false
  }: { title: string; description: string; split?: boolean } = $props();
</script>

<header class={['section-heading', split && 'section-heading--split']}>
  <h2>{title}</h2>
  <p>{description}</p>
</header>

<style>
  .section-heading {
    padding: 40px 44px 28px;
  }

  .section-heading h2 {
    color: #f4f4f5;
    font-family: 'IBM Plex Sans', sans-serif;
    font-size: clamp(2rem, 4vw, 3.25rem);
    font-weight: 400;
    line-height: 1;
    letter-spacing: -0.035em;
  }

  .section-heading p {
    max-width: 62ch;
    margin-top: 12px;
    color: #a1a1aa;
    font-family: 'IBM Plex Sans', sans-serif;
    font-size: 0.86rem;
    line-height: 1.6;
  }

  .section-heading--split {
    display: grid;
    grid-template-columns: minmax(240px, 0.8fr) minmax(280px, 1.2fr);
    align-items: end;
    gap: 48px;
  }

  .section-heading--split p {
    margin-top: 0;
  }

  :global(.motion-ready) .section-heading {
    opacity: 0;
    clip-path: inset(0 0 42% 0);
    transform: translateY(12px);
  }

  :global(.motion-ready.is-revealed) .section-heading {
    animation: section-resolve 0.68s cubic-bezier(0.16, 1, 0.3, 1) both;
  }

  @keyframes section-resolve {
    from {
      opacity: 0;
      clip-path: inset(0 0 42% 0);
      transform: translateY(12px);
    }
    to {
      opacity: 1;
      clip-path: inset(0 0 0 0);
      transform: translateY(0);
    }
  }

  @media (max-width: 800px) {
    .section-heading--split {
      grid-template-columns: 1fr;
      gap: 12px;
    }

    .section-heading--split p {
      margin-top: 0;
    }
  }

  @media (max-width: 600px) {
    .section-heading {
      padding: 32px 20px 24px;
    }

    .section-heading h2 {
      font-size: 2.3rem;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    :global(.motion-ready) .section-heading {
      animation: none;
      opacity: 1;
      clip-path: none;
      transform: none;
      transition: none;
    }
  }
</style>
