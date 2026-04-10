<script lang="ts">
  import { match } from 'ts-pattern';
  import { FileText, ExternalLink } from '@lucide/svelte/icons';

  import {
    projectLicense,
    dependenciesSection,
    portedCode,
    supportLinks
  } from '$lib/data/license-data';

  const getSupportTypeLabel = (type: string) =>
    match(type)
      .with('patreon', () => 'Patreon')
      .with('opencollective', () => 'OpenCollective')
      .with('github', () => 'GitHub Sponsors')
      .with('donate', () => 'Donate')
      .with('book', () => 'Book')
      .with('website', () => 'Website')
      .with('repo', () => 'Repository')
      .otherwise(() => 'Support');

  const libraryCreators = supportLinks.filter((s) => s.category === 'library');
  const educators = supportLinks.filter((s) => s.category === 'educator');
  const toolMaintainers = supportLinks.filter((s) => s.category === 'tool');
</script>

<div class="thanks-root">
  <!-- Header -->
  <div class="thanks-hero">
    <p class="thanks-eyebrow">patchies · gratitude</p>
    <h1 id="modal-title" class="thanks-headline">Made with love.</h1>
    <p class="thanks-subhead">
      Built upon amazing open source projects and the generosity of many people.
    </p>
  </div>

  <!-- Project License -->
  <div class="thanks-section">
    <div class="thanks-divider">
      <span class="thanks-divider-line"></span>
      <span class="thanks-divider-label">license</span>
      <span class="thanks-divider-line"></span>
    </div>
    <div class="thanks-panel">
      <p class="thanks-body">{projectLicense.description}</p>
      <ul class="thanks-list">
        {#each projectLicense.whatItMeans as point}
          <li>{point}</li>
        {/each}
      </ul>
      <a
        href={projectLicense.fullLicenseUrl}
        target="_blank"
        rel="noopener noreferrer"
        class="thanks-ext-link"
      >
        <FileText class="thanks-ext-icon" />
        {projectLicense.fullLicenseText}
      </a>
    </div>
  </div>

  <!-- Special Thanks -->
  <div class="thanks-section">
    <div class="thanks-divider">
      <span class="thanks-divider-line"></span>
      <span class="thanks-divider-label">special thanks</span>
      <span class="thanks-divider-line"></span>
    </div>
    <p class="thanks-section-desc">
      These people helped bring Patchies to life through their support, feedback, and encouragement.
    </p>

    <div class="thanks-people">
      <div class="person-card">
        <h3 class="person-name">Kijjasak "Kijjaz" Triyanond</h3>
        <p class="person-bio">
          A great senior and friend who dedicated thousands of hours to play testing Patchies. Gave
          countless inspirations, organized workshops, and taught me FM/AM synthesis and sound
          design.
        </p>
        <p class="person-meta">CU · CU BAND · Monotone Group · Pollen Sound · @vibrationperfum</p>
        <div class="person-links">
          <a
            href="https://www.instagram.com/kijjaz"
            target="_blank"
            rel="noopener noreferrer"
            class="person-link"
          >
            @kijjaz <ExternalLink class="person-link-icon" />
          </a>
        </div>
      </div>

      <div class="person-card">
        <h3 class="person-name">Thai Pangsakulyanont (@dtinth)</h3>
        <p class="person-bio">
          Gave invaluable advice throughout Patchies' development — coding guidance, API design, Web
          Audio API expertise, and most importantly, words of encouragement.
        </p>
        <p class="person-meta">Creatorsgarten · showdown.space · Bemusic</p>
        <div class="person-links">
          <a href="https://dt.in.th" target="_blank" rel="noopener noreferrer" class="person-link"
            >dt.in.th <ExternalLink class="person-link-icon" /></a
          >
          <a
            href="https://github.com/dtinth"
            target="_blank"
            rel="noopener noreferrer"
            class="person-link">GitHub <ExternalLink class="person-link-icon" /></a
          >
          <a
            href="https://youtube.com/@dtinth"
            target="_blank"
            rel="noopener noreferrer"
            class="person-link">YouTube <ExternalLink class="person-link-icon" /></a
          >
          <a
            href="https://creatorsgarten.org"
            target="_blank"
            rel="noopener noreferrer"
            class="person-link">Creatorsgarten <ExternalLink class="person-link-icon" /></a
          >
        </div>
      </div>

      <div class="person-card">
        <h3 class="person-name">Thanapat "Ryan" Ogaslert (@crsrcrsrrr)</h3>
        <p class="person-bio">
          Creator of SYNAP [home/lab], College of Music, Mahidol University. Inspired me to give my
          first ever talk about Patchies — where I showed it to the world for the first time.
        </p>
        <p class="person-meta">SYNAP [home/lab] · Monday music experiments & performances</p>
        <div class="person-links">
          <a
            href="https://www.instagram.com/crsrcrsrrr"
            target="_blank"
            rel="noopener noreferrer"
            class="person-link">@crsrcrsrrr <ExternalLink class="person-link-icon" /></a
          >
          <a
            href="https://www.instagram.com/synap.home.lab"
            target="_blank"
            rel="noopener noreferrer"
            class="person-link">@synap.home.lab <ExternalLink class="person-link-icon" /></a
          >
        </div>
      </div>

      <div class="person-card">
        <h3 class="person-name">Chayapatr "Pub" Archiwaranguprok (@chayapatr)</h3>
        <p class="person-bio">
          My closest friend, who gave me inspirations during the first days of Patchies when I was
          just playing with ideas. Organized countless events in Creatorsgarten.
        </p>
        <div class="person-links">
          <a href="https://from.pub" target="_blank" rel="noopener noreferrer" class="person-link"
            >from.pub <ExternalLink class="person-link-icon" /></a
          >
          <a
            href="https://www.media.mit.edu/people/pub"
            target="_blank"
            rel="noopener noreferrer"
            class="person-link">MIT Media Lab <ExternalLink class="person-link-icon" /></a
          >
          <a
            href="https://creatorsgarten.org"
            target="_blank"
            rel="noopener noreferrer"
            class="person-link">Creatorsgarten <ExternalLink class="person-link-icon" /></a
          >
        </div>
      </div>
    </div>
  </div>

  <!-- Support OSS Creators -->
  <div class="thanks-section">
    <div class="thanks-divider">
      <span class="thanks-divider-line"></span>
      <span class="thanks-divider-label">support open source</span>
      <span class="thanks-divider-line"></span>
    </div>
    <p class="thanks-section-desc">
      If you enjoy Patchies, consider supporting the creators behind the tools and libraries that
      made it possible.
    </p>

    <div class="oss-group">
      <p class="oss-group-label">Library & Tool Creators</p>
      <div class="oss-list">
        {#each libraryCreators as creator}
          <div class="oss-item">
            <div class="oss-item-head">
              <span class="oss-name">{creator.name}</span>
              <a href={creator.url} target="_blank" rel="noopener noreferrer" class="oss-chip">
                {getSupportTypeLabel(creator.type)}
                <ExternalLink class="oss-chip-icon" />
              </a>
            </div>
            <p class="oss-desc">{creator.description}</p>
            {#if creator.projects}
              <p class="oss-projects">{creator.projects.join(' · ')}</p>
            {/if}
          </div>
        {/each}
      </div>
    </div>

    <div class="oss-group">
      <p class="oss-group-label">Educators & Tutorial Creators</p>
      <div class="oss-list">
        {#each educators as educator}
          <div class="oss-item">
            <div class="oss-item-head">
              <span class="oss-name">{educator.name}</span>
              <a href={educator.url} target="_blank" rel="noopener noreferrer" class="oss-chip">
                {getSupportTypeLabel(educator.type)}
                <ExternalLink class="oss-chip-icon" />
              </a>
            </div>
            <p class="oss-desc">{educator.description}</p>
            {#if educator.projects}
              <p class="oss-projects">{educator.projects.join(' · ')}</p>
            {/if}
          </div>
        {/each}
      </div>
    </div>

    <div class="oss-group">
      <p class="oss-group-label">Tool & Dependency Maintainers</p>
      <div class="oss-list">
        {#each toolMaintainers as tool}
          <div class="oss-item">
            <div class="oss-item-head">
              <span class="oss-name">{tool.name}</span>
              <a href={tool.url} target="_blank" rel="noopener noreferrer" class="oss-chip">
                {getSupportTypeLabel(tool.type)}
                <ExternalLink class="oss-chip-icon" />
              </a>
            </div>
            <p class="oss-desc">{tool.description}</p>
            {#if tool.projects}
              <p class="oss-projects">{tool.projects.join(' · ')}</p>
            {/if}
          </div>
        {/each}
      </div>
    </div>
  </div>

  <!-- Ported Code -->
  <div class="thanks-section">
    <div class="thanks-divider">
      <span class="thanks-divider-line"></span>
      <span class="thanks-divider-label">ported & adapted code</span>
      <span class="thanks-divider-line"></span>
    </div>

    <div class="oss-list">
      {#each portedCode as code}
        <div class="oss-item">
          <div class="oss-item-head">
            <span class="oss-name">{code.name}</span>
            <span class="oss-license-chip">{code.license}</span>
          </div>
          <p class="oss-desc">{code.description}</p>
          <p class="oss-projects">
            {code.authors}{#if code.copyright}
              · {code.copyright}{/if}
          </p>
          <a
            href={code.repository}
            target="_blank"
            rel="noopener noreferrer"
            class="thanks-ext-link mt-1"
          >
            {code.repository}
            <ExternalLink class="thanks-ext-icon" />
          </a>
          {#if code.notes}
            <p class="oss-notes">{code.notes}</p>
          {/if}
        </div>
      {/each}
    </div>
  </div>

  <!-- All Dependencies -->
  <div class="thanks-section">
    <div class="thanks-divider">
      <span class="thanks-divider-line"></span>
      <span class="thanks-divider-label">all dependencies</span>
      <span class="thanks-divider-line"></span>
    </div>
    <p class="thanks-section-desc">{dependenciesSection.description}</p>

    <div class="deps-table-wrap">
      <table class="deps-table">
        <thead>
          <tr>
            <th>package</th>
            <th>license</th>
            <th>version</th>
          </tr>
        </thead>
        <tbody>
          {#each dependenciesSection.dependencies as dep}
            <tr>
              <td>
                {#if dep.url}
                  <a href={dep.url} target="_blank" rel="noopener noreferrer" class="dep-link"
                    >{dep.name}</a
                  >
                {:else}
                  {dep.name}
                {/if}
              </td>
              <td>{dep.license}</td>
              <td>{dep.version}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  </div>
</div>

<style>
  .thanks-root {
    display: flex;
    flex-direction: column;
    gap: 0;
  }

  /* Hero */
  .thanks-hero {
    padding-bottom: 24px;
  }

  .thanks-eyebrow {
    font-family: 'IBM Plex Mono', monospace;
    font-size: 10px;
    letter-spacing: 0.25em;
    text-transform: uppercase;
    color: rgba(249, 115, 22, 0.7);
    margin-bottom: 14px;
  }

  .thanks-headline {
    font-family: 'Instrument Serif', serif;
    font-style: italic;
    font-size: clamp(1.8rem, 5vw, 2.6rem);
    line-height: 1.12;
    color: #f4f4f5;
    margin-bottom: 12px;
  }

  .thanks-subhead {
    font-family: 'Syne', sans-serif;
    font-size: 0.82rem;
    line-height: 1.7;
    color: #52525b;
  }

  /* Section wrapper */
  .thanks-section {
    padding-bottom: 28px;
  }

  /* Dividers */
  .thanks-divider {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 16px;
  }

  .thanks-divider-line {
    flex: 1;
    height: 1px;
    background: rgba(255, 255, 255, 0.06);
  }

  .thanks-divider-label {
    font-family: 'IBM Plex Mono', monospace;
    font-size: 9px;
    letter-spacing: 0.25em;
    text-transform: uppercase;
    color: #3f3f46;
    white-space: nowrap;
  }

  .thanks-section-desc {
    font-family: 'Syne', sans-serif;
    font-size: 0.78rem;
    color: #52525b;
    line-height: 1.6;
    margin-bottom: 16px;
  }

  /* Panel (license) */
  .thanks-panel {
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 8px;
    padding: 16px 18px;
    background: rgba(255, 255, 255, 0.015);
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .thanks-body {
    font-family: 'Syne', sans-serif;
    font-size: 0.78rem;
    color: #71717a;
    line-height: 1.65;
  }

  .thanks-list {
    font-family: 'Syne', sans-serif;
    font-size: 0.75rem;
    color: #52525b;
    line-height: 1.7;
    padding-left: 16px;
    list-style: disc;
    display: flex;
    flex-direction: column;
    gap: 3px;
  }

  .thanks-ext-link {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    font-family: 'IBM Plex Mono', monospace;
    font-size: 10px;
    color: #52525b;
    text-decoration: none;
    transition: color 0.15s;
  }

  .thanks-ext-link:hover {
    color: #f97316;
  }

  :global(.thanks-ext-icon) {
    width: 11px;
    height: 11px;
    flex-shrink: 0;
  }

  /* People cards */
  .thanks-people {
    display: flex;
    flex-direction: column;
    gap: 1px;
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 8px;
    overflow: hidden;
  }

  .person-card {
    padding: 16px 18px;
    background: rgba(255, 255, 255, 0.01);
    border-bottom: 1px solid rgba(255, 255, 255, 0.04);
    transition: background 0.15s;
  }

  .person-card:last-child {
    border-bottom: none;
  }

  .person-card:hover {
    background: rgba(249, 115, 22, 0.025);
  }

  .person-name {
    font-family: 'Syne', sans-serif;
    font-size: 0.82rem;
    font-weight: 600;
    color: #d4d4d8;
    margin-bottom: 6px;
  }

  .person-bio {
    font-family: 'Syne', sans-serif;
    font-size: 0.75rem;
    color: #52525b;
    line-height: 1.65;
    margin-bottom: 6px;
  }

  .person-meta {
    font-family: 'IBM Plex Mono', monospace;
    font-size: 9px;
    color: #3f3f46;
    letter-spacing: 0.04em;
    margin-bottom: 8px;
  }

  .person-links {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .person-link {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    font-family: 'IBM Plex Mono', monospace;
    font-size: 10px;
    color: #52525b;
    text-decoration: none;
    transition: color 0.15s;
  }

  .person-link:hover {
    color: #f97316;
  }

  :global(.person-link-icon) {
    width: 10px;
    height: 10px;
  }

  /* OSS groups */
  .oss-group {
    margin-bottom: 20px;
  }

  .oss-group:last-child {
    margin-bottom: 0;
  }

  .oss-group-label {
    font-family: 'IBM Plex Mono', monospace;
    font-size: 9px;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    color: #3f3f46;
    margin-bottom: 10px;
  }

  .oss-list {
    display: flex;
    flex-direction: column;
    gap: 1px;
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 8px;
    overflow: hidden;
  }

  .oss-item {
    padding: 12px 16px;
    background: rgba(255, 255, 255, 0.01);
    border-bottom: 1px solid rgba(255, 255, 255, 0.04);
  }

  .oss-item:last-child {
    border-bottom: none;
  }

  .oss-item-head {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 5px;
    flex-wrap: wrap;
  }

  .oss-name {
    font-family: 'Syne', sans-serif;
    font-size: 0.8rem;
    font-weight: 600;
    color: #a1a1aa;
  }

  .oss-chip {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    font-family: 'IBM Plex Mono', monospace;
    font-size: 9px;
    letter-spacing: 0.05em;
    padding: 2px 7px;
    border-radius: 3px;
    border: 1px solid rgba(249, 115, 22, 0.2);
    background: rgba(249, 115, 22, 0.05);
    color: rgba(249, 115, 22, 0.6);
    text-decoration: none;
    transition:
      border-color 0.15s,
      background 0.15s,
      color 0.15s;
  }

  .oss-chip:hover {
    border-color: rgba(249, 115, 22, 0.4);
    background: rgba(249, 115, 22, 0.1);
    color: #f97316;
  }

  :global(.oss-chip-icon) {
    width: 9px;
    height: 9px;
  }

  .oss-license-chip {
    font-family: 'IBM Plex Mono', monospace;
    font-size: 9px;
    padding: 2px 7px;
    border-radius: 3px;
    border: 1px solid rgba(255, 255, 255, 0.08);
    color: #52525b;
  }

  .oss-desc {
    font-family: 'Syne', sans-serif;
    font-size: 0.73rem;
    color: #52525b;
    line-height: 1.55;
  }

  .oss-projects {
    font-family: 'IBM Plex Mono', monospace;
    font-size: 9px;
    color: #3f3f46;
    letter-spacing: 0.03em;
    margin-top: 4px;
  }

  .oss-notes {
    font-family: 'Syne', sans-serif;
    font-size: 0.72rem;
    color: #3f3f46;
    font-style: italic;
    margin-top: 5px;
    line-height: 1.5;
  }

  /* Dependencies table */
  .deps-table-wrap {
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 8px;
    overflow: hidden;
    overflow-x: auto;
  }

  .deps-table {
    width: 100%;
    border-collapse: collapse;
    font-family: 'IBM Plex Mono', monospace;
    font-size: 10px;
  }

  .deps-table thead tr {
    border-bottom: 1px solid rgba(255, 255, 255, 0.07);
  }

  .deps-table th {
    padding: 8px 12px;
    text-align: left;
    letter-spacing: 0.15em;
    text-transform: uppercase;
    font-size: 9px;
    color: #3f3f46;
    font-weight: 400;
    background: rgba(255, 255, 255, 0.015);
  }

  .deps-table tbody tr {
    border-bottom: 1px solid rgba(255, 255, 255, 0.04);
  }

  .deps-table tbody tr:last-child {
    border-bottom: none;
  }

  .deps-table td {
    padding: 7px 12px;
    color: #52525b;
  }

  .dep-link {
    color: #71717a;
    text-decoration: none;
    transition: color 0.15s;
  }

  .dep-link:hover {
    color: #f97316;
  }
</style>
