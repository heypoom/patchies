import { PaxaLiveSession, getPaxaRelayURL } from './live-session';
import { SpeechStreamPlayer } from './stream-player';
import type { SpeechOptions } from './speech';

interface LiveSpeechContext {
  getOptions: () => SpeechOptions;
  getApiKey: () => string;
  beforeStart: () => void;
  playAudio: (url: string) => void;
  stopAudio: () => void;
  showError: (message: string) => void;
}

export function useLiveSpeech(context: LiveSpeechContext) {
  let session: PaxaLiveSession | null = null;
  let player: SpeechStreamPlayer | null = null;

  let isLoading = $state(false);

  function stop() {
    session?.stop();
    session = null;

    if (player) {
      context.stopAudio();
      player.stop();
      player = null;
    }

    isLoading = false;
  }

  function append(text: string) {
    if (!text) return;

    if (!session?.acceptsText) {
      context.beforeStart();

      const options = context.getOptions();
      const apiKey = context.getApiKey();

      if (options.provider !== 'paxa') {
        context.showError(
          'Incremental text requires the Paxa provider. Select Paxa in model settings.'
        );
        return;
      }

      if (!apiKey) {
        context.showError('Please set your Paxa TTS API key in Settings → AI.');
        return;
      }

      if (!SpeechStreamPlayer.isSupported()) {
        context.showError('Incremental speech requires MP3 MediaSource support in your browser.');
        return;
      }

      isLoading = true;

      let current: PaxaLiveSession;

      try {
        current = new PaxaLiveSession({
          url: getPaxaRelayURL(location.origin),
          apiKey,
          model: options.model,
          voice: options.voiceName,
          onAudio: async (chunk) => {
            if (session !== current) return;

            player ??= new SpeechStreamPlayer(context.playAudio);

            await player.append(chunk);
          },
          onDone: async () => {
            if (session !== current) return;

            await player?.finish();

            if (session === current) {
              isLoading = false;
            }
          },
          onError: (message) => {
            if (session !== current) return;

            stop();
            context.showError(message);
          }
        });
        session = current;
      } catch {
        stop();
        context.showError('Could not open the Paxa live relay connection.');
        return;
      }
    }

    session.append(text);
  }

  return {
    append,
    flush: () => session?.flush(),
    end: () => session?.end(),
    stop,
    get isLoading() {
      return isLoading;
    }
  };
}
