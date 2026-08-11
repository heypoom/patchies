<script lang="ts">
  let { title, description }: { title: string; description: string } = $props();
</script>

<header class="tab-intro">
  <div class="tab-intro-copy">
    <h1>{title}</h1>
    <p>{description}</p>
  </div>
</header>

<style>
  .tab-intro {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 24px;
    padding: 30px 32px 28px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    background: #101012;
  }

  .tab-intro-copy {
    max-width: 680px;
  }

  h1 {
    max-width: 18ch;
    color: #f4f4f5;
    font-family: 'IBM Plex Sans', sans-serif;
    font-size: clamp(2rem, 5vw, 3.25rem);
    font-weight: 400;
    line-height: 1.02;
    letter-spacing: -0.035em;
    text-wrap: balance;
  }

  p {
    max-width: 62ch;
    margin-top: 12px;
    color: #a1a1aa;
    font-family: 'IBM Plex Sans', sans-serif;
    font-size: 0.9rem;
    line-height: 1.55;
  }

  @media (max-width: 600px) {
    .tab-intro {
      align-items: flex-start;
      flex-direction: column;
      gap: 18px;
      padding: 24px 20px;
    }

    h1 {
      font-size: clamp(2rem, 11vw, 2.75rem);
    }
  }
</style>
