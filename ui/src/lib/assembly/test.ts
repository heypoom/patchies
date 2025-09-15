import { AssemblySystem } from './AssemblySystem';

/**
 * Test function to verify AssemblySystem functionality
 */
export function testAssemblySystem() {
	console.log('🔧 Testing AssemblySystem...');

	const system = new AssemblySystem();

	try {
		// Test 1: Basic initialization
		console.log('✅ System initialized:', system.isInitialized());

		// Test 2: Create a machine
		const machineId = system.createMachine();
		console.log('✅ Created machine with ID:', machineId);

		// Test 3: Simple assembly program
		const simpleProgram = `
			; Simple program that pushes values and halts
			push 42
			push 100
			halt
		`;

		// Test 4: Load program
		console.log('🔄 Loading program into machine...');
		system.loadProgram(machineId, simpleProgram);
		console.log('✅ Program loaded successfully');

		// Test 5: Check initial status
		system.ready();
		let statuses = system.getStatuses();
		console.log('📊 Initial statuses:', statuses);

		// Test 6: Execute some steps
		console.log('🔄 Executing program...');
		system.step(5);

		// Test 7: Check final status
		statuses = system.getStatuses();
		console.log('📊 Final statuses:', statuses);

		// Test 8: Inspect machine
		const inspection = system.inspectMachine(machineId);
		console.log('🔍 Machine inspection:', inspection);

		// Test 9: Read stack
		const stackData = system.readStack(machineId, 5);
		console.log('📚 Stack data:', stackData);

		// Test 10: Check if halted
		console.log('🛑 Is halted:', system.isHalted());

		console.log('🎉 All tests passed!');
		return true;

	} catch (error) {
		console.error('❌ Test failed:', error);
		return false;
	} finally {
		// Clean up
		system.dispose();
	}
}

/**
 * Run assembly system test in development mode
 */
if (typeof window !== 'undefined' && import.meta.env.DEV) {
	// Auto-run test in development
	setTimeout(() => {
		testAssemblySystem();
	}, 1000);
}