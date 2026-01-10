<script lang="ts">
	import { FileText, Heart, ExternalLink } from '@lucide/svelte/icons';
	import type { Tab } from './types';
	import {
		projectLicense,
		dependenciesSection,
		portedCode,
		supportLinks
	} from '$lib/data/license-data';

	let { setTab }: { setTab: (tab: Tab) => void } = $props();

	const getSupportTypeLabel = (type: string) => {
		switch (type) {
			case 'patreon':
				return 'Patreon';
			case 'opencollective':
				return 'OpenCollective';
			case 'github':
				return 'GitHub Sponsors';
			case 'donate':
				return 'Donate';
			case 'purchase':
				return 'Purchase';
			case 'website':
				return 'Website';
			default:
				return 'Support';
		}
	};

	const libraryCreators = supportLinks.filter((s) => s.category === 'library');
	const educators = supportLinks.filter((s) => s.category === 'educator');
	const toolMaintainers = supportLinks.filter((s) => s.category === 'tool');
</script>

<div class="space-y-4">
	<!-- Header -->
	<div>
		<h1 id="modal-title" class="text-3xl font-bold text-zinc-100">Thanks 🥰</h1>
		<p class="mt-1 text-lg text-zinc-400">Patchies is built upon amazing open source projects and the generosity of many people</p>
	</div>

	<!-- Project License -->
	<div class="rounded-lg bg-zinc-800/50 p-4">
		<p class="text-zinc-300">
			{projectLicense.description}
		</p>
		<div class="mt-3 space-y-2 text-sm text-zinc-400">
			<p class="font-semibold text-zinc-300">What this means:</p>
			<ul class="ml-4 list-disc space-y-1">
				{#each projectLicense.whatItMeans as point}
					<li>{point}</li>
				{/each}
			</ul>
		</div>
		<div class="mt-3">
			<a
				href={projectLicense.fullLicenseUrl}
				target="_blank"
				rel="noopener noreferrer"
				class="flex items-center gap-2 text-sm text-blue-400 hover:underline"
			>
				<FileText class="h-4 w-4" />
				{projectLicense.fullLicenseText}
			</a>
		</div>
	</div>

	<!-- Support Open Source Creators -->
	<div class="rounded-lg bg-zinc-800/50 p-4">
		<div class="mb-3 flex items-center gap-2">
			<Heart class="h-5 w-5 text-red-400" />
			<h2 class="text-lg font-semibold text-zinc-200">Support Open Source Creators</h2>
		</div>
		<p class="mb-4 text-sm text-zinc-300">
			If you enjoy using Patchies, please consider supporting the creators who made it possible:
		</p>

		<!-- Library Creators -->
		<div class="mb-4">
			<h3 class="mb-2 text-sm font-semibold text-zinc-300">Library & Tool Creators</h3>
			<div class="space-y-2">
				{#each libraryCreators as creator}
					<div class="rounded-lg bg-zinc-900/50 p-3">
						<div class="flex items-start justify-between">
							<div class="flex-1">
								<div class="flex items-center gap-2">
									<h4 class="text-sm font-semibold text-zinc-100">{creator.name}</h4>
									<a
										href={creator.url}
										target="_blank"
										rel="noopener noreferrer"
										class="flex items-center gap-1 rounded bg-blue-600/20 px-2 py-0.5 text-xs text-blue-400 hover:bg-blue-600/30"
									>
										{getSupportTypeLabel(creator.type)}
										<ExternalLink class="h-3 w-3" />
									</a>
								</div>
								<p class="mt-1 text-xs text-zinc-400">{creator.description}</p>
								{#if creator.projects}
									<p class="mt-1 text-xs text-zinc-500">
										Projects: {creator.projects.join(', ')}
									</p>
								{/if}
							</div>
						</div>
					</div>
				{/each}
			</div>
		</div>

		<!-- Educators -->
		<div>
			<h3 class="mb-2 text-sm font-semibold text-zinc-300">Educators & Tutorial Creators</h3>
			<div class="space-y-2">
				{#each educators as educator}
					<div class="rounded-lg bg-zinc-900/50 p-3">
						<div class="flex items-start justify-between">
							<div class="flex-1">
								<div class="flex items-center gap-2">
									<h4 class="text-sm font-semibold text-zinc-100">{educator.name}</h4>
									<a
										href={educator.url}
										target="_blank"
										rel="noopener noreferrer"
										class="flex items-center gap-1 rounded bg-blue-600/20 px-2 py-0.5 text-xs text-blue-400 hover:bg-blue-600/30"
									>
										{getSupportTypeLabel(educator.type)}
										<ExternalLink class="h-3 w-3" />
									</a>
								</div>
								<p class="mt-1 text-xs text-zinc-400">{educator.description}</p>
								{#if educator.projects}
									<p class="mt-1 text-xs text-zinc-500">
										Resources: {educator.projects.join(', ')}
									</p>
								{/if}
							</div>
						</div>
					</div>
				{/each}
			</div>
		</div>

		<!-- Tool Maintainers -->
		<div class="mt-4">
			<h3 class="mb-2 text-sm font-semibold text-zinc-300">Tool & Dependency Maintainers</h3>
			<p class="mb-2 text-xs text-zinc-400">
				These maintainers create and maintain essential development tools and libraries:
			</p>
			<div class="space-y-2">
				{#each toolMaintainers as tool}
					<div class="rounded-lg bg-zinc-900/50 p-3">
						<div class="flex items-start justify-between">
							<div class="flex-1">
								<div class="flex items-center gap-2">
									<h4 class="text-sm font-semibold text-zinc-100">{tool.name}</h4>
									<a
										href={tool.url}
										target="_blank"
										rel="noopener noreferrer"
										class="flex items-center gap-1 rounded bg-blue-600/20 px-2 py-0.5 text-xs text-blue-400 hover:bg-blue-600/30"
									>
										{getSupportTypeLabel(tool.type)}
										<ExternalLink class="h-3 w-3" />
									</a>
								</div>
								<p class="mt-1 text-xs text-zinc-400">{tool.description}</p>
								{#if tool.projects}
									<p class="mt-1 text-xs text-zinc-500">
										Projects: {tool.projects.join(', ')}
									</p>
								{/if}
							</div>
						</div>
					</div>
				{/each}
			</div>
		</div>
	</div>

	<!-- Ported/Adapted Code -->
	<div class="rounded-lg bg-zinc-800/50 p-4">
		<h2 class="mb-3 text-lg font-semibold text-zinc-200">Ported & Adapted Code</h2>
		<p class="mb-4 text-sm text-zinc-300">
			Patchies includes code ported from other open source projects:
		</p>

		<div class="space-y-4">
			{#each portedCode as code}
				<div class="rounded-lg bg-zinc-900/50 p-3">
					<div class="mb-2 flex items-start justify-between">
						<div>
							<h3 class="text-sm font-semibold text-zinc-100">{code.name}</h3>
							<p class="mt-1 text-xs text-zinc-400">{code.description}</p>
						</div>
						<span class="ml-2 rounded bg-zinc-700 px-2 py-1 font-mono text-xs text-zinc-300"
							>{code.license}</span
						>
					</div>

					<div class="mt-2 space-y-1 text-xs text-zinc-400">
						<p>
							<span class="font-semibold text-zinc-300">Authors:</span>
							{code.authors}
						</p>
						{#if code.copyright}
							<p>
								<span class="font-semibold text-zinc-300">Copyright:</span>
								{code.copyright}
							</p>
						{/if}
						<p>
							<span class="font-semibold text-zinc-300">Repository:</span>
							<a
								href={code.repository}
								target="_blank"
								rel="noopener noreferrer"
								class="text-blue-400 hover:underline"
							>
								{code.repository}
							</a>
						</p>
						{#if code.notes}
							<p class="mt-2 text-zinc-500 italic">{code.notes}</p>
						{/if}
					</div>
				</div>
			{/each}
		</div>
	</div>

	<!-- Special Thanks -->
	<div class="rounded-lg bg-zinc-800/50 p-4">
		<div class="mb-3 flex items-center gap-2">
			<Heart class="h-5 w-5 text-pink-400" />
			<h2 class="text-lg font-semibold text-zinc-200">Special Thanks</h2>
		</div>
		<p class="mb-4 text-sm text-zinc-300">
			These amazing people helped bring Patchies to life through their direct support, feedback, and encouragement. I can't thank them enough.
		</p>

		<div class="space-y-4">
			<!-- Kijjaz -->
			<div class="rounded-lg bg-zinc-900/50 p-3">
				<h3 class="text-sm font-semibold text-zinc-100">Kijjasak "Kijjaz" Triyanond (@kijjaz)</h3>
				<p class="mt-1 text-xs text-zinc-300">
					A great senior and friend who dedicated thousands of hours to play testing Patchies. Kijjaz created many test patches, gave countless inspirations and feedback, organized fun workshops with us, and taught me FM/AM synthesis and sound design.
				</p>
				<p class="mt-2 text-xs text-zinc-400">
					Communities: CU, CU BAND, Monotone Group, Pollen Sound • Indie perfumer at @vibrationperfum
				</p>
				<a
					href="https://www.instagram.com/kijjaz"
					target="_blank"
					rel="noopener noreferrer"
					class="mt-2 inline-flex items-center gap-1 text-xs text-blue-400 hover:underline"
				>
					Instagram @kijjaz
					<ExternalLink class="h-3 w-3" />
				</a>
			</div>

			<!-- dtinth -->
			<div class="rounded-lg bg-zinc-900/50 p-3">
				<h3 class="text-sm font-semibold text-zinc-100">Thai Pangsakulyanont (@dtinth)</h3>
				<p class="mt-1 text-xs text-zinc-300">
					A long time senior and friend who gave invaluable advice throughout Patchies' development. Thai provided coding guidance, Web Audio API expertise, tips on using AI effectively, and most importantly, words of encouragement.
				</p>
				<p class="mt-2 text-xs text-zinc-400">
					Communities: Creatorsgarten, showdown.space, Bemusic
				</p>
				<div class="mt-2 flex flex-wrap gap-2">
					<a
						href="https://dt.in.th"
						target="_blank"
						rel="noopener noreferrer"
						class="inline-flex items-center gap-1 text-xs text-blue-400 hover:underline"
					>
						dt.in.th
						<ExternalLink class="h-3 w-3" />
					</a>
					<a
						href="https://github.com/dtinth"
						target="_blank"
						rel="noopener noreferrer"
						class="inline-flex items-center gap-1 text-xs text-blue-400 hover:underline"
					>
						GitHub
						<ExternalLink class="h-3 w-3" />
					</a>
					<a
						href="https://www.instagram.com/dtinth"
						target="_blank"
						rel="noopener noreferrer"
						class="inline-flex items-center gap-1 text-xs text-blue-400 hover:underline"
					>
						Instagram
						<ExternalLink class="h-3 w-3" />
					</a>
					<a
						href="https://creatorsgarten.org"
						target="_blank"
						rel="noopener noreferrer"
						class="inline-flex items-center gap-1 text-xs text-blue-400 hover:underline"
					>
						Creatorsgarten
						<ExternalLink class="h-3 w-3" />
					</a>
				</div>
			</div>

			<!-- Ryan -->
			<div class="rounded-lg bg-zinc-900/50 p-3">
				<h3 class="text-sm font-semibold text-zinc-100">Thanapat "Ryan" Ogaslert (@crsrcrsrrr)</h3>
				<p class="mt-1 text-xs text-zinc-300">
					Creator of SYNAP [home/lab], works at College of Music, Mahidol University. Ryan encouraged me through making Patchies and inspired me to give my first talk about Patchies at SYNAP [home/lab], where I got to show it to the world for the first time.
				</p>
				<p class="mt-2 text-xs text-zinc-400">
					SYNAP [home/lab]: Monday music experiments and performances
				</p>
				<div class="mt-2 flex gap-3">
					<a
						href="https://www.instagram.com/crsrcrsrrr"
						target="_blank"
						rel="noopener noreferrer"
						class="inline-flex items-center gap-1 text-xs text-blue-400 hover:underline"
					>
						@crsrcrsrrr
						<ExternalLink class="h-3 w-3" />
					</a>
					<a
						href="https://www.instagram.com/synap.home.lab"
						target="_blank"
						rel="noopener noreferrer"
						class="inline-flex items-center gap-1 text-xs text-blue-400 hover:underline"
					>
						@synap.home.lab
						<ExternalLink class="h-3 w-3" />
					</a>
				</div>
			</div>

			<!-- Pub -->
			<div class="rounded-lg bg-zinc-900/50 p-3">
				<h3 class="text-sm font-semibold text-zinc-100">Chayapatr "Pub" Archiwaranguprok (chayapatr)</h3>
				<p class="mt-1 text-xs text-zinc-300">
					My long-time friend and my closest friend. Pub gave me lots of inspirations during the first days of Patchies, when I was just playing around with ideas. He organized countless events in our collective, Creatorsgarten.
				</p>
				<p class="mt-2 text-xs text-zinc-400">
					<a
						href="https://from.pub"
						target="_blank"
						rel="noopener noreferrer"
						class="inline-flex items-center gap-1 text-xs text-blue-400 hover:underline"
					>
						from.pub
						<ExternalLink class="h-3 w-3" />
					</a>
					<a
						href="https://www.media.mit.edu/people/pub"
						target="_blank"
						rel="noopener noreferrer"
						class="inline-flex items-center gap-1 text-xs text-blue-400 hover:underline"
					>
						MIT Media Lab
						<ExternalLink class="h-3 w-3" />
					</a>
					<a
						href="https://creatorsgarten.org"
						target="_blank"
						rel="noopener noreferrer"
						class="inline-flex items-center gap-1 text-xs text-blue-400 hover:underline"
					>
						Creatorsgarten
						<ExternalLink class="h-3 w-3" />
					</a>
				</p>
			</div>
		</div>
	</div>

	<!-- All Dependencies -->
	<div class="rounded-lg bg-zinc-800/50 p-4">
		<h2 class="mb-3 text-lg font-semibold text-zinc-200">{dependenciesSection.title}</h2>
		<p class="mb-4 text-sm text-zinc-300">
			{dependenciesSection.description}
		</p>

		<div class="overflow-x-auto">
			<table class="w-full text-xs">
				<thead>
					<tr class="border-b border-zinc-700">
						<th class="px-2 py-2 text-left text-zinc-300">Package</th>
						<th class="px-2 py-2 text-left text-zinc-300">License</th>
						<th class="px-2 py-2 text-left text-zinc-300">Version</th>
					</tr>
				</thead>
				<tbody>
					{#each dependenciesSection.dependencies as dependency}
						<tr class="border-b border-zinc-800">
							<td class="px-2 py-2">
								{#if dependency.url}
									<a
										href={dependency.url}
										target="_blank"
										rel="noopener noreferrer"
										class="text-zinc-300 hover:underline"
									>
										{dependency.name}
									</a>
								{:else}
									{dependency.name}
								{/if}
							</td>
							<td class="px-2 py-2 font-mono text-zinc-400">{dependency.license}</td>
							<td class="px-2 py-2 text-zinc-400">{dependency.version}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	</div>
</div>
