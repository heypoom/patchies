import type { Textmodifier } from 'textmode.js';

type SetupCallback = () => void | Promise<void>;

/**
 * Runs code against an existing Textmodifier and replays its newly registered
 * setup callback when the instance has already completed initialization.
 */
export async function evaluateTextmodeCode(
  tm: Textmodifier,
  executeCode: () => Promise<unknown>,
  replaySetup: boolean
) {
  const setup = tm.setup.bind(tm);
  let setupCallback: SetupCallback | undefined;

  tm.setup = async (callback) => {
    setupCallback = callback;
    await setup(callback);
  };

  try {
    await executeCode();
  } finally {
    tm.setup = setup;
  }

  if (replaySetup && setupCallback) {
    await setupCallback();
  }
}
