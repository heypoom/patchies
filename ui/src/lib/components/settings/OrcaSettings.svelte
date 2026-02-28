<script lang="ts">
  let {
    gridWidth,
    gridHeight,
    syncTransport,
    bpm,
    transportBpm,
    showInterface,
    showGuide,
    fontSize,
    canvasDensity,
    onGridWidthChange,
    onGridHeightChange,
    onSyncTransportChange,
    onBpmChange,
    onShowInterfaceChange,
    onShowGuideChange,
    onFontSizeChange,
    onCanvasDensityChange
  }: {
    gridWidth: number;
    gridHeight: number;
    syncTransport: boolean;
    bpm: number;
    transportBpm: number;
    showInterface: boolean;
    showGuide: boolean;
    fontSize: number;
    canvasDensity: number;
    onGridWidthChange: (width: number) => void;
    onGridHeightChange: (height: number) => void;
    onSyncTransportChange: () => void;
    onBpmChange: (bpm: number) => void;
    onShowInterfaceChange: (show: boolean) => void;
    onShowGuideChange: (show: boolean) => void;
    onFontSizeChange: (size: number) => void;
    onCanvasDensityChange: (density: number) => void;
  } = $props();
</script>

<div class="nodrag w-64 rounded-lg border border-zinc-600 bg-zinc-900 shadow-xl">
  <div class="space-y-3 p-4">
    <div class="space-y-2">
      <div class="text-xs font-medium text-zinc-400">Grid Settings</div>
      <div class="grid grid-cols-2 gap-2">
        <label class="flex flex-col text-xs text-zinc-400">
          <span>Width:</span>
          <input
            type="number"
            min="4"
            max="256"
            value={gridWidth}
            onchange={(e) => {
              const val = parseInt(e.currentTarget.value);
              if (!isNaN(val) && val > 0) {
                onGridWidthChange(val);
              }
            }}
            class="mt-1 w-full rounded bg-zinc-800 px-2 py-1 text-xs text-white"
          />
        </label>
        <label class="flex flex-col text-xs text-zinc-400">
          <span>Height:</span>
          <input
            type="number"
            min="4"
            max="256"
            value={gridHeight}
            onchange={(e) => {
              const val = parseInt(e.currentTarget.value);
              if (!isNaN(val) && val > 0) {
                onGridHeightChange(val);
              }
            }}
            class="mt-1 w-full rounded bg-zinc-800 px-2 py-1 text-xs text-white"
          />
        </label>
      </div>
    </div>

    <div class="space-y-2">
      <div class="text-xs font-medium text-zinc-400">Clock</div>

      <label class="flex items-center gap-2 text-xs text-zinc-400">
        <span>BPM:</span>
        <input
          type="number"
          min="60"
          max="300"
          value={syncTransport ? transportBpm : bpm}
          disabled={syncTransport}
          onchange={(e) => {
            const val = parseInt(e.currentTarget.value);
            if (!isNaN(val)) {
              onBpmChange(val);
            }
          }}
          class="w-20 rounded bg-zinc-800 px-2 py-1 text-xs text-white disabled:cursor-not-allowed disabled:opacity-50"
        />
      </label>

      <label class="flex items-center gap-2 text-xs text-zinc-400">
        <input
          type="checkbox"
          checked={syncTransport}
          onchange={onSyncTransportChange}
          class="cursor-pointer rounded"
        />

        <span>Sync to transport</span>
      </label>
    </div>

    <div class="space-y-2">
      <div class="text-xs font-medium text-zinc-400">Display Options</div>
      <label class="flex items-center gap-2 text-xs text-zinc-400">
        <input
          type="checkbox"
          checked={showInterface}
          onchange={(e) => onShowInterfaceChange(e.currentTarget.checked)}
          class="cursor-pointer rounded"
        />

        <span>Show Status Interface</span>
      </label>

      <label class="flex items-center gap-2 text-xs text-zinc-400">
        <input
          type="checkbox"
          checked={showGuide}
          onchange={(e) => onShowGuideChange(e.currentTarget.checked)}
          class="cursor-pointer rounded"
        />

        <span>Show Operator Guide</span>
      </label>

      <label class="flex flex-col text-xs text-zinc-400">
        <span>Font Size: {fontSize.toFixed(1)}x</span>
        <div class="mt-1 flex items-center gap-2">
          <button
            onclick={() => onFontSizeChange(Math.max(0.5, fontSize - 0.1))}
            class="cursor-pointer rounded bg-zinc-700 px-2 py-1 text-xs hover:bg-zinc-600"
          >
            −
          </button>
          <button
            onclick={() => onFontSizeChange(Math.min(2.0, fontSize + 0.1))}
            class="cursor-pointer rounded bg-zinc-700 px-2 py-1 text-xs hover:bg-zinc-600"
          >
            +
          </button>
          <span class="flex-1 text-xs text-zinc-500">(Ctrl +/−)</span>
        </div>
      </label>

      <label class="flex flex-col text-xs text-zinc-400">
        <span>Canvas Density: {canvasDensity}x</span>
        <div class="mt-1 flex items-center gap-2">
          <button
            onclick={() => onCanvasDensityChange(Math.max(1, canvasDensity - 1))}
            class="cursor-pointer rounded bg-zinc-700 px-2 py-1 text-xs hover:bg-zinc-600"
          >
            −
          </button>
          <button
            onclick={() => onCanvasDensityChange(Math.min(5, canvasDensity + 1))}
            class="cursor-pointer rounded bg-zinc-700 px-2 py-1 text-xs hover:bg-zinc-600"
          >
            +
          </button>
        </div>
      </label>
    </div>
  </div>
</div>
