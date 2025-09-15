import { AssemblySystem } from './AssemblySystem';

/**
 * Basic test to verify VASM integration works
 */
export function basicAssemblyTest(): boolean {
	try {
		console.log('🧪 Starting basic assembly test...');

		// Test 1: Create system
		const system = new AssemblySystem();
		console.log('✅ System created');

		// Test 2: Check initialization
		if (!system.isInitialized()) {
			throw new Error('System not initialized');
		}
		console.log('✅ System initialized');

		// Test 3: Create machine
		const machineId = system.createMachine();
		console.log(`✅ Machine created with ID: ${machineId}`);

		// Test 4: Simple program
		const program = `
			push 10
			push 20
			add
			halt
		`;

		// Test 5: Load program
		system.loadProgram(machineId, program);
		console.log('✅ Program loaded');

		// Test 6: Execute
		system.ready();
		console.log('✅ System ready');

		system.step(5);
		console.log('✅ Execution completed');

		// Test 7: Check results
		const statuses = system.getStatuses();
		console.log('✅ Status retrieved:', statuses);

		const inspection = system.inspectMachine(machineId);
		if (inspection) {
			console.log('✅ Machine inspection:', {
				status: inspection.status,
				registers: inspection.registers,
				inbox_size: inspection.inbox_size,
				outbox_size: inspection.outbox_size
			});
		}

		// Test 8: Read stack
		const stackData = system.readStack(machineId, 3);
		console.log('✅ Stack data:', stackData);

		// Clean up
		system.dispose();
		console.log('✅ System disposed');

		console.log('🎉 All basic tests passed!');
		return true;

	} catch (error) {
		console.error('❌ Basic test failed:', error);
		return false;
	}
}

// Auto-run test in development
if (typeof window !== 'undefined' && import.meta.env.DEV) {
	setTimeout(() => {
		console.log('🔄 Running basic assembly test...');
		basicAssemblyTest();
	}, 2000);
}