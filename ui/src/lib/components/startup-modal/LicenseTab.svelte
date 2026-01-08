<script lang="ts">
	import { FileText } from '@lucide/svelte/icons';
	import type { Tab } from './types';
	import { projectLicense, dependenciesSection, portedCode } from '$lib/data/license-data';

	let { setTab }: { setTab: (tab: Tab) => void } = $props();
</script>

<div class="space-y-4">
	<!-- Header -->
	<div>
		<h1 id="modal-title" class="text-3xl font-bold text-zinc-100">Licenses & Attributions</h1>
		<p class="mt-1 text-lg text-zinc-400">Patchies is built upon amazing open source projects</p>
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
							<p class="mt-2 italic text-zinc-500">{code.notes}</p>
						{/if}
					</div>
				</div>
			{/each}
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
