// A tiny, disposable scratch canvas, reused every call rather than
// created fresh: nothing here is ever exported, saved, or read outside
// this function.
let scratchCanvas: HTMLCanvasElement | null = null;

export function sampleBrightness(video: HTMLVideoElement): number {
  if (!scratchCanvas) {
    scratchCanvas = document.createElement("canvas");
    scratchCanvas.width = 16;
    scratchCanvas.height = 16;
  }
  const ctx = scratchCanvas.getContext("2d", { willReadFrequently: true });
  if (!ctx || video.videoWidth === 0) return 255;
  ctx.drawImage(video, 0, 0, 16, 16);
  const { data } = ctx.getImageData(0, 0, 16, 16);
  let total = 0;
  for (let i = 0; i < data.length; i += 4) {
    total += (data[i] + data[i + 1] + data[i + 2]) / 3;
  }
  return total / (data.length / 4);
}
