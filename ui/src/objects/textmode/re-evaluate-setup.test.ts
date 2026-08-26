import { describe, expect, it, vi } from 'vitest';
import { evaluateTextmodeCode } from './re-evaluate-setup';

describe('evaluateTextmodeCode', () => {
  it('replays the setup callback registered during a re-evaluation', async () => {
    const setup = vi.fn();
    const setupCallback = vi.fn();
    const tm = { setup };

    await evaluateTextmodeCode(
      tm as never,
      async () => {
        await tm.setup(setupCallback);
      },
      true
    );

    expect(setup).toHaveBeenCalledWith(setupCallback);
    expect(setupCallback).toHaveBeenCalledTimes(1);
  });

  it('leaves initial setup to the Textmodifier lifecycle', async () => {
    const setup = vi.fn();
    const setupCallback = vi.fn();
    const tm = { setup };

    await evaluateTextmodeCode(
      tm as never,
      async () => {
        await tm.setup(setupCallback);
      },
      false
    );

    expect(setupCallback).not.toHaveBeenCalled();
  });
});
