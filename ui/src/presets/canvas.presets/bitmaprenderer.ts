export const BITMAPRENDERER_JS = `setTitle('Bitmap Renderer');

const canvas = document.createElement('canvas');
const ctx = canvas.getContext('bitmaprenderer');

canvas.className = 'block w-full h-full rounded-lg bg-zinc-950';
root.appendChild(canvas);

recv((data) => {
  if (data && data instanceof ImageBitmap) {
    if (canvas.width !== data.width || canvas.height !== data.height) {
      canvas.width = data.width;
      canvas.height = data.height;

      setSize(data.width, data.height);
    }

    ctx.transferFromImageBitmap(data);
  }
});`;

export const bitmapRendererPreset = {
  type: 'dom' as const,
  data: {
    code: BITMAPRENDERER_JS,
    inletCount: 1,
    outletCount: 0
  }
};
