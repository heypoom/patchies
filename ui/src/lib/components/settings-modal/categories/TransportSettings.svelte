<script lang="ts">
  import SettingRow from '../SettingRow.svelte';
  import { transportStore } from '../../../../stores/transport.store';

  function handleBpmInput(e: Event) {
    const target = e.target as HTMLInputElement;
    const bpm = Number(target.value);
    if (bpm > 0 && bpm <= 999) {
      transportStore.update((s) => ({ ...s, bpm }));
    }
  }

  function handleTimeSigNumInput(e: Event) {
    const target = e.target as HTMLInputElement;
    const num = Number(target.value);
    if (num > 0 && num <= 32) {
      transportStore.update((s) => ({
        ...s,
        timeSignature: [num, s.timeSignature[1]]
      }));
    }
  }

  function handleTimeSigDenInput(e: Event) {
    const target = e.target as HTMLInputElement;
    const den = Number(target.value);
    if (den > 0 && den <= 32) {
      transportStore.update((s) => ({
        ...s,
        timeSignature: [s.timeSignature[0], den]
      }));
    }
  }
</script>

<SettingRow title="BPM" description="Beats per minute for this patch">
  <input
    type="number"
    value={$transportStore.bpm}
    oninput={handleBpmInput}
    min="1"
    max="999"
    class="w-20 rounded border border-white/10 bg-white/5 px-2 py-1 font-mono text-xs text-zinc-300 transition-colors outline-none hover:border-white/20 focus:border-orange-500/40"
  />
</SettingRow>

<SettingRow title="Time signature" description="Beats per bar for this patch">
  <div class="flex items-center gap-1">
    <input
      type="number"
      value={$transportStore.timeSignature[0]}
      oninput={handleTimeSigNumInput}
      min="1"
      max="32"
      class="w-12 rounded border border-white/10 bg-white/5 px-2 py-1 text-center font-mono text-xs text-zinc-300 transition-colors outline-none hover:border-white/20 focus:border-orange-500/40"
    />
    <span class="text-xs text-zinc-600">/</span>
    <input
      type="number"
      value={$transportStore.timeSignature[1]}
      oninput={handleTimeSigDenInput}
      min="1"
      max="32"
      class="w-12 rounded border border-white/10 bg-white/5 px-2 py-1 text-center font-mono text-xs text-zinc-300 transition-colors outline-none hover:border-white/20 focus:border-orange-500/40"
    />
  </div>
</SettingRow>
