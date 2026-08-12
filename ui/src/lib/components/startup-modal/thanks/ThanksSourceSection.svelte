<script lang="ts">
  import { ExternalLink, FileText } from '@lucide/svelte/icons';

  import { dependenciesSection, portedCode, projectLicense } from '$lib/data/license-data';

  import { revealSection } from './thanks-tab-motion';
  import ThanksSectionHeading from './ThanksSectionHeading.svelte';
</script>

<section class="source-section" {@attach revealSection}>
  <ThanksSectionHeading
    title="Make it yours."
    description="Patchies carries its license, adapted code, and dependencies in the open."
    split
  />

  <div class="license-block" {@attach revealSection}>
    <div class="license-title">
      <span>{projectLicense.license}</span>
      <p>{projectLicense.description}</p>
      <a href={projectLicense.fullLicenseUrl} target="_blank" rel="noopener noreferrer">
        <FileText class="inline-icon" aria-hidden="true" />
        {projectLicense.fullLicenseText}
      </a>
    </div>
    <ul>
      {#each projectLicense.whatItMeans as point (point)}
        <li>{point}</li>
      {/each}
    </ul>
  </div>

  <div class="ledger-group" {@attach revealSection}>
    <div class="ledger-heading">
      <h3>Ported & adapted code</h3>
      <span>{portedCode.length} sources</span>
    </div>
    <div class="ported-grid">
      {#each portedCode as code (code.name)}
        <details class="source-entry">
          <summary>
            <span>{code.name}</span>
            <span class="source-license">{code.license}</span>
          </summary>
          <div class="source-entry-body">
            <p>{code.description}</p>
            <small>
              {code.authors}{#if code.copyright}
                · {code.copyright}{/if}
            </small>
            <a href={code.repository} target="_blank" rel="noopener noreferrer">
              Repository <ExternalLink class="inline-icon" aria-hidden="true" />
            </a>
            {#if code.notes}
              <p class="source-note">{code.notes}</p>
            {/if}
          </div>
        </details>
      {/each}
    </div>
  </div>

  <div class="ledger-group" {@attach revealSection}>
    <div class="ledger-heading ledger-heading--dependencies">
      <div>
        <h3>All dependencies</h3>
        <p>{dependenciesSection.description}</p>
      </div>
      <span>{dependenciesSection.dependencies.length} packages</span>
    </div>

    <div class="deps-table-wrap">
      <table class="deps-table">
        <thead>
          <tr>
            <th>Package</th>
            <th>License</th>
            <th>Version</th>
          </tr>
        </thead>
        <tbody>
          {#each dependenciesSection.dependencies as dependency (dependency.name)}
            <tr>
              <td>
                {#if dependency.url}
                  <a href={dependency.url} target="_blank" rel="noopener noreferrer">
                    {dependency.name}
                  </a>
                {:else}
                  {dependency.name}
                {/if}
              </td>
              <td>{dependency.license}</td>
              <td>{dependency.version}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  </div>
</section>

<style>
  .source-section {
    position: relative;
    padding-bottom: 48px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    background: #09090b;
  }

  .license-block {
    position: relative;
    display: grid;
    grid-template-columns: minmax(0, 1.1fr) minmax(280px, 0.9fr);
    gap: 40px;
    margin: 0 44px;
    padding: 28px 0 34px;
    border-top: 1px solid rgba(249, 115, 22, 0.42);
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  }

  .license-block::after {
    position: absolute;
    top: -1px;
    left: 0;
    width: 30%;
    height: 1px;
    background: linear-gradient(90deg, transparent, #fb923c, transparent);
    content: '';
    opacity: 0;
    transform: translateX(-110%);
  }

  .license-title > span {
    color: #fb923c;
    font-family: 'IBM Plex Mono', monospace;
    font-size: 0.72rem;
    letter-spacing: 0.05em;
  }

  .license-title p {
    max-width: 56ch;
    margin: 10px 0 16px;
    color: #a1a1aa;
    font-family: 'IBM Plex Sans', sans-serif;
    font-size: 0.78rem;
    line-height: 1.6;
  }

  .license-block ul {
    display: flex;
    flex-direction: column;
    gap: 8px;
    color: #a1a1aa;
    font-family: 'IBM Plex Sans', sans-serif;
    font-size: 0.75rem;
    line-height: 1.5;
    list-style: none;
  }

  .license-title a,
  .source-entry-body a {
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

  .license-title a:hover,
  .source-entry-body a:hover {
    color: #fb923c;
    transform: translateX(2px);
  }

  .license-title a:hover :global(.inline-icon),
  .source-entry-body a:hover :global(.inline-icon) {
    transform: translate(2px, -2px);
  }

  .license-title a:focus-visible,
  .source-entry-body a:focus-visible,
  .deps-table a:focus-visible,
  .source-entry summary:focus-visible {
    outline: 2px solid rgba(251, 146, 60, 0.85);
    outline-offset: 3px;
  }

  :global(.inline-icon) {
    width: 11px;
    height: 11px;
    flex: 0 0 auto;
    transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  }

  .ledger-group {
    position: relative;
    margin: 36px 44px 0;
  }

  .ledger-group::before {
    position: absolute;
    top: -14px;
    left: 0;
    width: 100%;
    height: 1px;
    background: linear-gradient(90deg, rgba(249, 115, 22, 0.6), rgba(249, 115, 22, 0.08));
    content: '';
    opacity: 0;
    transform: scaleX(0);
    transform-origin: left;
  }

  .ledger-heading {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 20px;
    margin-bottom: 14px;
  }

  .ledger-heading h3 {
    color: #d4d4d8;
    font-family: 'IBM Plex Sans', sans-serif;
    font-size: 0.9rem;
    font-weight: 500;
  }

  .ledger-heading > span {
    color: #52525b;
    font-family: 'IBM Plex Mono', monospace;
    font-size: 0.58rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .ledger-heading p {
    margin-top: 4px;
    color: #71717a;
    font-family: 'IBM Plex Sans', sans-serif;
    font-size: 0.7rem;
  }

  .ported-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    border-top: 1px solid rgba(255, 255, 255, 0.08);
    border-left: 1px solid rgba(255, 255, 255, 0.08);
  }

  .source-entry {
    min-width: 0;
    border-right: 1px solid rgba(255, 255, 255, 0.08);
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  }

  .source-entry summary {
    display: flex;
    min-height: 52px;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 13px 16px;
    color: #a1a1aa;
    cursor: pointer;
    font-family: 'IBM Plex Sans', sans-serif;
    font-size: 0.72rem;
    font-weight: 500;
    list-style: none;
    transition:
      background 0.15s ease,
      color 0.15s ease;
  }

  .source-entry summary::-webkit-details-marker {
    display: none;
  }

  .source-entry summary::after {
    color: #71717a;
    font-family: 'IBM Plex Mono', monospace;
    font-size: 0.8rem;
    content: '+';
  }

  .source-entry[open] summary::after {
    color: #f97316;
    content: '−';
  }

  .source-entry summary:hover,
  .source-entry[open] summary {
    background: rgba(255, 255, 255, 0.03);
    color: #e4e4e7;
  }

  .source-license {
    margin-left: auto;
    color: #52525b;
    font-family: 'IBM Plex Mono', monospace;
    font-size: 0.56rem;
    font-weight: 400;
  }

  .source-entry-body {
    padding: 16px 16px 18px;
  }

  .source-entry[open] .source-entry-body {
    animation: ledger-entry-open 0.28s cubic-bezier(0.16, 1, 0.3, 1) both;
  }

  .source-entry-body p {
    color: #a1a1aa;
    font-family: 'IBM Plex Sans', sans-serif;
    font-size: 0.69rem;
    line-height: 1.55;
  }

  .source-entry-body small {
    display: block;
    margin: 10px 0;
    color: #52525b;
    font-family: 'IBM Plex Mono', monospace;
    font-size: 0.56rem;
    line-height: 1.5;
  }

  .source-entry-body .source-note {
    margin-top: 10px;
    color: #52525b;
    font-style: italic;
  }

  .deps-table-wrap {
    overflow-x: auto;
    border: 1px solid rgba(255, 255, 255, 0.08);
  }

  .deps-table {
    width: 100%;
    border-collapse: collapse;
    font-family: 'IBM Plex Mono', monospace;
    font-size: 0.62rem;
  }

  .deps-table th {
    padding: 10px 14px;
    background: rgba(255, 255, 255, 0.025);
    color: #71717a;
    font-size: 0.55rem;
    font-weight: 500;
    letter-spacing: 0.12em;
    text-align: left;
    text-transform: uppercase;
  }

  .deps-table td {
    padding: 9px 14px;
    border-top: 1px solid rgba(255, 255, 255, 0.05);
    color: #a1a1aa;
    white-space: nowrap;
  }

  .deps-table td:first-child {
    width: 56%;
    color: #a1a1aa;
  }

  .deps-table a {
    color: #a1a1aa;
    text-decoration: none;
  }

  .deps-table a:hover {
    color: #fb923c;
  }

  .license-block:global(.motion-ready) > *,
  .ledger-group:global(.motion-ready) > * {
    opacity: 0;
    transform: translateY(10px);
  }

  .license-block:global(.motion-ready.is-revealed) > *,
  .ledger-group:global(.motion-ready.is-revealed) > * {
    animation: detail-resolve 0.4s cubic-bezier(0.16, 1, 0.3, 1) 0.04s both;
  }

  .license-block:global(.motion-ready.is-revealed)::after {
    animation: license-scan 0.72s cubic-bezier(0.16, 1, 0.3, 1) 0.06s both;
  }

  .ledger-group:global(.motion-ready.is-revealed)::before {
    animation: connection-draw 0.54s cubic-bezier(0.16, 1, 0.3, 1) both;
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

  @keyframes license-scan {
    0% {
      opacity: 0;
      transform: translateX(-110%);
    }
    22% {
      opacity: 1;
    }
    100% {
      opacity: 0;
      transform: translateX(330%);
    }
  }

  @keyframes ledger-entry-open {
    from {
      opacity: 0;
      clip-path: inset(0 0 28% 0);
      transform: translateY(-5px);
    }
    to {
      opacity: 1;
      clip-path: inset(0 0 0 0);
      transform: translateY(0);
    }
  }

  @media (max-width: 800px) {
    .ported-grid {
      grid-template-columns: 1fr;
    }

    .license-block {
      grid-template-columns: 1fr;
      gap: 22px;
    }
  }

  @media (max-width: 600px) {
    .license-block,
    .ledger-group {
      margin-inline: 20px;
    }

    .license-block {
      padding-top: 24px;
    }

    .ported-grid {
      border-left: 0;
    }

    .source-entry {
      border-left: 1px solid rgba(255, 255, 255, 0.08);
    }

    .ledger-heading--dependencies {
      align-items: flex-start;
      flex-direction: column;
      gap: 8px;
    }

    .deps-table {
      min-width: 580px;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .license-block:global(.motion-ready) > *,
    .license-block:global(.motion-ready)::after,
    .ledger-group:global(.motion-ready) > *,
    .ledger-group:global(.motion-ready)::before,
    .source-entry[open] .source-entry-body {
      animation: none;
      opacity: 1;
      clip-path: none;
      transform: none;
      transition: none;
    }
  }
</style>
