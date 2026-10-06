/** Reuse the shared Tone context without replacing its transport. */
export async function loadTone(audioContext: AudioContext) {
  const Tone = await import('tone');

  if (Tone.getContext().rawContext !== audioContext) {
    polyfillAudioListenerForFirefox(audioContext);
    Tone.setContext(new Tone.Context(audioContext));
  }

  return Tone;
}

// Firefox lacks the AudioListener AudioParams required by Tone.js.
function polyfillAudioListenerForFirefox(audioContext: AudioContext) {
  const listener = audioContext.listener;

  // Check if polyfill is needed (Firefox lacks these as AudioParams)
  if (listener.forwardX !== undefined) return;

  // Create a real AudioParam by using a ConstantSourceNode
  // This passes the `instanceof AudioParam` check that Tone.js uses
  const createRealAudioParam = (defaultValue: number): AudioParam => {
    const node = audioContext.createConstantSource();
    node.offset.value = defaultValue;

    return node.offset;
  };

  // Polyfill the missing properties with real AudioParams
  Object.defineProperties(listener, {
    positionX: {
      value: createRealAudioParam(0),
      configurable: true
    },
    positionY: {
      value: createRealAudioParam(0),
      configurable: true
    },
    positionZ: {
      value: createRealAudioParam(0),
      configurable: true
    },
    forwardX: {
      value: createRealAudioParam(0),
      configurable: true
    },
    forwardY: {
      value: createRealAudioParam(0),
      configurable: true
    },
    forwardZ: {
      value: createRealAudioParam(-1),
      configurable: true
    },
    upX: {
      value: createRealAudioParam(0),
      configurable: true
    },
    upY: {
      value: createRealAudioParam(1),
      configurable: true
    },
    upZ: {
      value: createRealAudioParam(0),
      configurable: true
    }
  });
}
