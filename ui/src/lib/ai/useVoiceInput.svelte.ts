import { toast } from 'svelte-sonner';
import { selectMimeType, arrayBufferToBase64, transcribeAudio } from './stt';
import { AudioService } from '$lib/audio/v2/AudioService';

export function useVoiceInput(onTranscribed: (text: string) => void) {
  let isRecording = $state(false);
  let isTranscribing = $state(false);
  let level = $state(0);

  let mediaRecorder: MediaRecorder | null = null;
  let mediaStream: MediaStream | null = null;
  let chunks: Blob[] = [];
  let mimeType = '';
  let abortController: AbortController | null = null;
  let levelAnimFrame: number | null = null;

  const audioContext = AudioService.getInstance().getAudioContext();

  function startLevelMeter(stream: MediaStream) {
    const source = audioContext.createMediaStreamSource(stream);

    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 256;

    source.connect(analyser);

    const dataArray = new Uint8Array(analyser.frequencyBinCount);

    function poll() {
      analyser.getByteFrequencyData(dataArray);
      level = dataArray.reduce((a, b) => a + b, 0) / dataArray.length / 255;
      levelAnimFrame = requestAnimationFrame(poll);
    }

    levelAnimFrame = requestAnimationFrame(poll);
  }

  function stopLevelMeter() {
    if (levelAnimFrame !== null) {
      cancelAnimationFrame(levelAnimFrame);
      levelAnimFrame = null;
    }

    level = 0;
  }

  async function handleStop() {
    const type = mimeType || 'audio/webm';
    const blob = new Blob(chunks, { type });
    chunks = [];

    if (blob.size < 1000) {
      toast.error('Recording too short');
      return;
    }

    isTranscribing = true;
    abortController = new AbortController();

    try {
      const base64 = arrayBufferToBase64(await blob.arrayBuffer());

      const text = await transcribeAudio(base64, type.split(';')[0], {
        signal: abortController.signal
      });

      if (text) onTranscribed(text);
    } catch (error) {
      if (error instanceof Error && error.name !== 'AbortError') {
        toast.error(error instanceof Error ? error.message : 'Transcription failed');
      }
    } finally {
      isTranscribing = false;
      abortController = null;
    }
  }

  async function start() {
    try {
      mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      toast.error('Microphone access denied');
      return;
    }

    startLevelMeter(mediaStream);
    mimeType = selectMimeType();
    chunks = [];

    mediaRecorder = new MediaRecorder(mediaStream, mimeType ? { mimeType } : {});

    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };

    mediaRecorder.onstop = handleStop;
    mediaRecorder.start(100);
    isRecording = true;
  }

  function stop() {
    mediaRecorder?.stop();
    mediaStream?.getTracks().forEach((t) => t.stop());
    mediaStream = null;
    isRecording = false;

    stopLevelMeter();
  }

  function toggle() {
    if (isRecording) stop();
    else start();
  }

  function destroy() {
    if (isRecording) stop();
    else stopLevelMeter();
    abortController?.abort();
  }

  return {
    get isRecording() {
      return isRecording;
    },
    get isTranscribing() {
      return isTranscribing;
    },
    get level() {
      return level;
    },
    start,
    stop,
    toggle,
    destroy
  };
}
