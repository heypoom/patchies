<script lang="ts">
	import * as Dialog from '$lib/components/ui/dialog';
	import { isAiFeaturesVisible } from '../../../stores/ui.store';
	import { toast } from 'svelte-sonner';

	let {
		open = $bindable(false),
		onSaveAndContinue
	}: {
		open: boolean;
		onSaveAndContinue: () => void;
	} = $props();

	let apiKeyInput = $state('');
	let apiKeyError = $state<string | null>(null);

	function validateAndSave() {
		apiKeyError = null;

		const trimmedKey = apiKeyInput.trim();

		if (!trimmedKey) {
			apiKeyError = 'API key cannot be empty';
			return;
		}

		if (!trimmedKey.startsWith('AIza')) {
			apiKeyError = 'Invalid API key format. Gemini API keys start with "AIza"';
			return;
		}

		// Save the key
		localStorage.setItem('gemini-api-key', trimmedKey);

		// Close dialog and notify parent
		open = false;
		onSaveAndContinue();
	}

	function hideAiFeatures() {
		$isAiFeaturesVisible = false;
		open = false;

		toast.success('All AI features hidden. Use "Ctrl+K > Toggle AI Features" to re-enable them.');
	}

	// Reset state when dialog opens
	$effect(() => {
		if (open) {
			apiKeyInput = '';
			apiKeyError = null;
		}
	});
</script>

<Dialog.Root bind:open>
	<Dialog.Content class="sm:max-w-md">
		<Dialog.Header>
			<Dialog.Title>Gemini API Key Required</Dialog.Title>
		</Dialog.Header>
		<div class="space-y-4">
			<p class="text-sm text-zinc-300">
				AI features require a Google Gemini API key. Get a free API key at
				<a
					href="https://aistudio.google.com/app/apikey"
					target="_blank"
					rel="noopener noreferrer"
					class="text-blue-400 underline hover:text-blue-300"
				>
					Google AI Studio
				</a>.
			</p>

			<div class="space-y-2">
				<label for="gemini-key-input" class="block text-sm text-zinc-300">
					Enter your API key:
				</label>
				<input
					id="gemini-key-input"
					type="password"
					bind:value={apiKeyInput}
					onkeydown={(e) => {
						if (e.key === 'Enter') {
							e.preventDefault();
							validateAndSave();
						}
					}}
					placeholder="AIza..."
					class="w-full rounded border border-zinc-600 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 focus:ring-2 focus:ring-blue-500 focus:outline-none"
				/>
				{#if apiKeyError}
					<p class="text-xs text-red-400">{apiKeyError}</p>
				{/if}
			</div>

			<p class="text-xs text-zinc-400">
				⚠️ Create a separate API key with strict budget limits. Keys are stored in browser
				localStorage.
			</p>

			<p class="text-xs text-zinc-500">
				Don't want to use AI features?
				<button
					onclick={hideAiFeatures}
					class="cursor-pointer text-red-400 underline hover:text-red-300"
				>
					Hide all AI features.
				</button>
			</p>
		</div>
		<Dialog.Footer class="flex gap-2">
			<button
				onclick={() => (open = false)}
				class="flex-1 cursor-pointer rounded bg-zinc-700 px-3 py-2 text-sm font-medium text-zinc-200 transition-colors hover:bg-zinc-600"
			>
				Cancel
			</button>
			<button
				onclick={validateAndSave}
				class="flex-1 cursor-pointer rounded bg-blue-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-500"
			>
				Save & Continue
			</button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
