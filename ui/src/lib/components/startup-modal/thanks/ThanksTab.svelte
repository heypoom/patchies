<script lang="ts">
  import ThanksEcosystemSection from './ThanksEcosystemSection.svelte';
  import ThanksHero from './ThanksHero.svelte';
  import ThanksPeopleSection from './ThanksPeopleSection.svelte';
  import ThanksSourceSection from './ThanksSourceSection.svelte';
</script>

<div class="credits-root">
  <ThanksHero />
  <ThanksPeopleSection />
  <ThanksEcosystemSection />
  <ThanksSourceSection />
</div>

<style>
  .credits-root {
    min-height: 100%;
    overflow: hidden;
    background: #0b0b0d;
    color: #e4e4e7;
  }
</style>
