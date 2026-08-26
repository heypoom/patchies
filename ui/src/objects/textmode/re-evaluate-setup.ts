import type { Textmodifier } from 'textmode.js';

type SetupCallback = () => void | Promise<void>;

const evaluationsByTextmodifier = new WeakMap<Textmodifier, Promise<void>>();

/**
 * Runs code against an existing Textmodifier and replays its newly registered
 * setup callback when the instance has already completed initialization.
 */
export function evaluateTextmodeCode(
  tm: Textmodifier,
  executeCode: () => Promise<unknown>,
  replaySetup: boolean
): Promise<void> {
  const previousEvaluation = evaluationsByTextmodifier.get(tm) ?? Promise.resolve();

  const evaluation = previousEvaluation.then(() =>
    runTextmodeEvaluation(tm, executeCode, replaySetup)
  );

  const settledEvaluation = evaluation.catch(() => undefined);

  evaluationsByTextmodifier.set(tm, settledEvaluation);

  settledEvaluation.then(() => {
    if (evaluationsByTextmodifier.get(tm) === settledEvaluation) {
      evaluationsByTextmodifier.delete(tm);
    }
  });

  return evaluation;
}

async function runTextmodeEvaluation(
  tm: Textmodifier,
  executeCode: () => Promise<unknown>,
  replaySetup: boolean
) {
  const setup = tm.setup;
  let setupCallback: SetupCallback | undefined;

  tm.setup = async (callback) => {
    setupCallback = callback;

    await setup.call(tm, callback);
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
