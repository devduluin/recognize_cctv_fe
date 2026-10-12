export async function consumeCameraFrames(
  response: Response,
  signal: AbortSignal,
  onFrame: (jpeg: Uint8Array<ArrayBuffer>) => Promise<void>,
) {
  if (!response.ok || !response.body ||
      !response.headers.get("content-type")?.includes("application/x-camera-frames")) {
    throw new Error("Stream kamera tidak tersedia.");
  }
  const reader = response.body.getReader();
  let pending = new Uint8Array(0);
  try {
    while (!signal.aborted) {
      const { value, done } = await reader.read();
      if (done) throw new Error("Stream kamera terputus.");
      const merged = new Uint8Array(pending.length + value.length);
      merged.set(pending);
      merged.set(value, pending.length);
      pending = merged;
      while (pending.length >= 4 && !signal.aborted) {
        const size = new DataView(pending.buffer, pending.byteOffset, 4).getUint32(0);
        if (size === 0 || size > 8 * 1024 * 1024) {
          throw new Error("Frame kamera tidak valid.");
        }
        if (pending.length < size + 4) break;
        const jpeg = pending.slice(4, size + 4);
        pending = pending.slice(size + 4);
        await onFrame(jpeg);
      }
    }
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}
