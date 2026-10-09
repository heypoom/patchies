<script lang="ts">
  let { code, fontSize }: { code: string; fontSize: number } = $props();

  export const editor = {
    repl: { scheduler: {} },
    evaluate: () => {},
    stop: () => {},
    setCode: () => {},
    setFontFamily: () => {},
    setFontSize: () => {}
  };
</script>

<div class="mock-strudel-editor h-full w-full font-mono" style:font-size={`${fontSize}px`}>
  {code}
</div>
