<script lang="ts">
	import { onMount } from 'svelte';
	import { getAssemblySystem } from '$lib/assembly';

	let system = $state<any>(null);
	let machineId = $state<number | null>(null);
	let status = $state<string>('Not initialized');
	let output = $state<string[]>([]);
	let assemblyCode = $state(`; Simple assembly program
push 42
push 100
add
halt`);

	function log(message: string) {
		output = [...output, `[${new Date().toLocaleTimeString()}] ${message}`];
	}

	onMount(() => {
		try {
			system = getAssemblySystem();
			log('✅ AssemblySystem initialized');
			status = 'Ready';
		} catch (error) {
			log(`❌ Failed to initialize: ${error}`);
			status = 'Error';
		}
	});

	function createMachine() {
		if (!system) {
			log('❌ System not initialized');
			return;
		}

		try {
			machineId = system.createMachine();
			log(`✅ Created machine with ID: ${machineId}`);
		} catch (error) {
			log(`❌ Failed to create machine: ${error}`);
		}
	}

	function loadProgram() {
		if (!system || machineId === null) {
			log('❌ No machine available');
			return;
		}

		try {
			system.loadProgram(machineId, assemblyCode);
			log('✅ Program loaded successfully');
		} catch (error) {
			log(`❌ Failed to load program: ${error}`);
		}
	}

	function readyAndExecute() {
		if (!system) {
			log('❌ System not initialized');
			return;
		}

		try {
			system.ready();
			log('✅ Machines marked as ready');

			// Execute multiple steps
			for (let i = 0; i < 5; i++) {
				if (!system.isHalted()) {
					system.step(1);
					log(`📋 Executed step ${i + 1}`);
				}
			}

			// Check final status
			const statuses = system.getStatuses();
			log(`📊 Final statuses: ${JSON.stringify(statuses)}`);

			if (machineId !== null) {
				const inspection = system.inspectMachine(machineId);
				log(`🔍 Machine inspection: ${JSON.stringify(inspection, null, 2)}`);

				const stackData = system.readStack(machineId, 5);
				log(`📚 Stack data: ${JSON.stringify(stackData)}`);
			}
		} catch (error) {
			log(`❌ Execution failed: ${error}`);
		}
	}

	function runFullTest() {
		log('🧪 Running full test suite...');
	}

	function clearOutput() {
		output = [];
	}
</script>

<svelte:head>
	<title>Assembly System Test</title>
</svelte:head>

<main class="mx-auto max-w-4xl p-8">
	<h1 class="mb-6 text-3xl font-bold">Assembly System Test</h1>

	<div class="mb-4">
		<strong>Status:</strong>
		<span
			class="rounded px-2 py-1 text-sm font-medium"
			class:bg-green-100={status === 'Ready'}
			class:text-green-800={status === 'Ready'}
			class:bg-red-100={status === 'Error'}
			class:text-red-800={status === 'Error'}
			class:bg-gray-100={status === 'Not initialized'}
			class:text-gray-800={status === 'Not initialized'}
		>
			{status}
		</span>
	</div>

	<div class="grid grid-cols-1 gap-6 md:grid-cols-2">
		<!-- Controls -->
		<div class="space-y-4">
			<h2 class="text-xl font-semibold">Controls</h2>

			<div class="space-y-2">
				<button onclick={createMachine} disabled={!system} class="btn btn-primary w-full">
					Create Machine
				</button>

				<button
					onclick={loadProgram}
					disabled={!system || machineId === null}
					class="btn btn-secondary w-full"
				>
					Load Program
				</button>

				<button onclick={readyAndExecute} disabled={!system} class="btn btn-accent w-full">
					Ready & Execute
				</button>

				<button onclick={runFullTest} class="btn btn-info w-full"> Run Full Test </button>

				<button onclick={clearOutput} class="btn btn-outline w-full"> Clear Output </button>
			</div>

			<!-- Assembly Code Editor -->
			<div>
				<label class="mb-2 block text-sm font-medium">Assembly Code:</label>
				<textarea
					bind:value={assemblyCode}
					class="h-32 w-full rounded border p-2 font-mono text-sm"
					placeholder="Enter assembly code here..."
				>
				</textarea>
			</div>
		</div>

		<!-- Output -->
		<div>
			<h2 class="mb-4 text-xl font-semibold">Output</h2>
			<div class="h-96 overflow-y-auto rounded p-4 font-mono text-sm">
				{#each output as line}
					<div class="mb-1">{line}</div>
				{/each}
				{#if output.length === 0}
					<div class="text-gray-500">No output yet...</div>
				{/if}
			</div>
		</div>
	</div>
</main>
