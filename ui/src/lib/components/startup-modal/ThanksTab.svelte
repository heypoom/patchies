<script lang="ts">
  import { ExternalLink, FileText, Heart } from '@lucide/svelte/icons';

  import {
    dependenciesSection,
    portedCode,
    projectLicense,
    supportLinks
  } from '$lib/data/license-data';

  const supportTypeLabels: Record<string, string> = {
    patreon: 'Patreon',
    opencollective: 'OpenCollective',
    github: 'GitHub Sponsors',
    donate: 'Donate',
    book: 'Book',
    website: 'Website',
    repo: 'Repository'
  };

  const supportGroups = [
    {
      category: 'library',
      title: 'Libraries & tools',
      description: 'The people building the creative systems Patchies connects.'
    },
    {
      category: 'educator',
      title: 'Teachers & references',
      description: 'The people who made difficult ideas possible to learn.'
    },
    {
      category: 'tool',
      title: 'Infrastructure',
      description: 'The maintainers keeping the underlying web platform moving.'
    }
  ] as const;

  const specialPeople = [
    {
      shortName: 'Kijjaz',
      name: 'Kijjasak "Kijjaz" Triyanond',
      bio: 'A great senior and friend who dedicated thousands of hours to playtesting Patchies. Shared countless inspirations, suggested new nodes, organized workshops, and taught me FM/AM synthesis and sound design.',
      meta: 'CU · CU BAND · Monotone Group · Pollen Sound · @vibrationperfum',
      links: [{ label: '@kijjaz', href: 'https://www.instagram.com/kijjaz' }]
    },
    {
      shortName: 'Thai',
      name: 'Thai Pangsakulyanont (@dtinth)',
      bio: 'Gave invaluable advice throughout Patchies’ development — coding guidance, API design, Web Audio API expertise, suggestions for new nodes, and most importantly, words of encouragement.',
      meta: 'Creatorsgarten · showdown.space · Bemusic',
      links: [
        { label: 'dt.in.th', href: 'https://dt.in.th' },
        { label: 'GitHub', href: 'https://github.com/dtinth' },
        { label: 'YouTube', href: 'https://youtube.com/@dtinth' }
      ]
    },
    {
      shortName: 'Ryan',
      name: 'Thanapat "Ryan" Ogaslert (@crsrcrsrrr)',
      bio: 'Creator of SYNAP [home/lab], College of Music, Mahidol University. Inspired me to give my first ever talk about Patchies.',
      meta: 'SYNAP [home/lab] · Monday music experiments & performances',
      links: [
        { label: '@crsrcrsrrr', href: 'https://www.instagram.com/crsrcrsrrr' },
        { label: '@synap.home.lab', href: 'https://www.instagram.com/synap.home.lab' }
      ]
    },
    {
      shortName: 'Pub',
      name: 'Chayapatr "Pub" Archiwaranguprok (@chayapatr)',
      bio: 'My closest friend, who inspired me during the earliest days of Patchies when I was just playing with ideas. Designed the new Patchies logo and organized countless events in Creatorsgarten.',
      meta: 'Creatorsgarten · MIT Media Lab',
      links: [
        { label: 'from.pub', href: 'https://from.pub' },
        { label: 'MIT Media Lab', href: 'https://www.media.mit.edu/people/pub' },
        { label: 'Creatorsgarten', href: 'https://creatorsgarten.org' }
      ]
    },
    {
      shortName: 'Chun',
      name: 'Rapeepat "Chun" Kaewprasith',
      bio: 'Shared lots of ideas throughout Patchies’ development and has always been a great friend.',
      meta: '',
      links: [
        { label: 'chunrapeepat.com', href: 'https://chunrapeepat.com' },
        { label: 'Instagram', href: 'https://www.instagram.com/chunrapeepat' },
        { label: 'StoryMotion', href: 'https://storymotion.video' },
        { label: 'LearnAlgorithm', href: 'https://learnalgorithm.com/' }
      ]
    },
    {
      shortName: 'Patt',
      name: 'Patt Vira',
      bio: 'Gave great advice and made our lunch conversations a constant source of inspiration.',
      meta: '',
      links: [
        { label: 'pattvira.com', href: 'https://www.pattvira.com' },
        { label: 'YouTube', href: 'https://www.youtube.com/@pattvira' },
        { label: 'Instagram', href: 'https://www.instagram.com/pattvira' },
        { label: 'X', href: 'https://x.com/pattvira' }
      ]
    }
  ];
</script>

<div class="credits-root">
  <section class="credits-hero">
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

            <p class="credits-index-copy">AGPL-3.0, adapted code and libraries we use.</p>
          </div>

          <span>
            {portedCode.length} adapted · {dependenciesSection.dependencies.length} dependencies
          </span>
        </div>
      </div>
    </div>
  </section>

  <section class="people-section">
    <header class="section-heading">
      <h2>The people in the patch.</h2>
      <p>These people helped bring Patchies to life through their guidance.</p>
    </header>

    <div class="people-grid">
      {#each specialPeople as person, index (person.name)}
        <article class="person-card person-card--{index + 1}">
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

  <section class="ecosystem-section">
    <header class="section-heading section-heading--split">
      <h2>Support the source.</h2>
      <p>
        If you enjoy Patchies, consider supporting the creators behind the tools and libraries that
        made it possible.
      </p>
    </header>

    <div class="ecosystem-grid">
      {#each supportGroups as group (group.category)}
        <section class="support-channel">
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

  <section class="source-section">
    <header class="section-heading section-heading--split">
      <h2>Make it yours.</h2>
      <p>Patchies carries its license, adapted code, and dependencies in the open.</p>
    </header>

    <div class="license-block">
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

    <div class="ledger-group">
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

    <div class="ledger-group">
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
</div>

<style>
  .credits-root {
    min-height: 100%;
    overflow: hidden;
    background: #0b0b0d;
    color: #e4e4e7;
  }

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
    animation: reveal-credit 0.6s cubic-bezier(0.16, 1, 0.3, 1) both;
  }

  .collective-statement span {
    color: #f97316;
  }

  .credits-index {
    margin-inline: -42px;
    border-top: 1px solid rgba(255, 255, 255, 0.09);
  }

  .credits-index-row {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: end;
    gap: 28px;
    padding: 14px 42px 15px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.07);
    animation: reveal-credit 0.55s cubic-bezier(0.16, 1, 0.3, 1) both;
  }

  .credits-index-row:nth-child(1) {
    animation-delay: 0.12s;
  }

  .credits-index-row:nth-child(2) {
    animation-delay: 0.2s;
  }

  .credits-index-row:nth-child(3) {
    animation-delay: 0.28s;
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

  .people-section,
  .ecosystem-section,
  .source-section {
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  }

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

  .person-links a,
  .license-title a,
  .source-entry-body a {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    color: #a1a1aa;
    font-family: 'IBM Plex Mono', monospace;
    font-size: 0.65rem;
    text-decoration: none;
    transition: color 0.15s ease;
  }

  .person-links a:hover,
  .license-title a:hover,
  .source-entry-body a:hover {
    color: #fb923c;
  }

  .person-links a:focus-visible,
  .license-title a:focus-visible,
  .source-entry-body a:focus-visible,
  .support-row:focus-visible,
  .deps-table a:focus-visible,
  .source-entry summary:focus-visible {
    outline: 2px solid rgba(251, 146, 60, 0.85);
    outline-offset: 3px;
  }

  :global(.inline-icon) {
    width: 11px;
    height: 11px;
    flex: 0 0 auto;
  }

  .ecosystem-section {
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
    content: '';
    position: absolute;
    top: 0;
    bottom: 0;
    left: 27px;
    width: 1px;
    background: rgba(249, 115, 22, 0.28);
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
    transition: background 0.15s ease;
  }

  .support-row:hover {
    background: rgba(249, 115, 22, 0.045);
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

  .source-section {
    padding-bottom: 48px;
    background: #09090b;
  }

  .license-block {
    display: grid;
    grid-template-columns: minmax(0, 1.1fr) minmax(280px, 0.9fr);
    gap: 40px;
    margin: 0 44px;
    padding: 28px 0 34px;
    border-top: 1px solid rgba(249, 115, 22, 0.42);
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
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

  .ledger-group {
    margin: 36px 44px 0;
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
    content: '+';
    color: #71717a;
    font-family: 'IBM Plex Mono', monospace;
    font-size: 0.8rem;
  }

  .source-entry[open] summary::after {
    content: '−';
    color: #f97316;
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

  @keyframes reveal-credit {
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

    .section-heading--split {
      grid-template-columns: 1fr;
      gap: 12px;
    }

    .section-heading--split p {
      margin-top: 0;
    }

    .people-grid,
    .ported-grid {
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

    .license-block {
      grid-template-columns: 1fr;
      gap: 22px;
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

    .section-heading {
      padding: 32px 20px 24px;
    }

    .section-heading h2 {
      font-size: 2.3rem;
    }

    .person-card {
      min-height: 0;
      padding: 28px 20px 30px;
    }

    .person-port {
      left: 20px;
    }

    .person-short {
      margin-bottom: 20px;
    }

    .channel-heading {
      min-height: 112px;
      padding-inline: 20px;
    }

    .channel-heading::before {
      left: 23px;
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
    .collective-statement,
    .credits-index-row {
      animation: none;
      opacity: 1;
      transform: none;
    }
  }
</style>
