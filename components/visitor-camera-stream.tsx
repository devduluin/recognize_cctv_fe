"use client";

import { useEffect, useRef } from "react";
import { visitorFetch } from "./auth/visitor-api";
import { consumeCameraFrames } from "./camera-frames";

export default function VisitorCameraStream({ src, name, onError }: {
  src: string;
  name: string;
  onError: () => void;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const errorHandler = useRef(onError);
  useEffect(() => { errorHandler.current = onError; }, [onError]);
  useEffect(() => {
    const controller = new AbortController();
    let timeout: ReturnType<typeof setTimeout>;
    let timedOut = false;
    function armTimeout() {
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        timedOut = true;
        controller.abort();
      }, 15000);
    }
    armTimeout();
    async function stream() {
      try {
        const response = await visitorFetch(`${src}&format=frames`, {
          signal: controller.signal,
          cache: "no-store",
        });
        await consumeCameraFrames(response, controller.signal, async (jpeg) => {
          const bitmap = await createImageBitmap(new Blob([jpeg], { type: "image/jpeg" }));
          try {
            if (controller.signal.aborted) return;
            const target = canvas.current;
            if (!target) return;
            if (target.width !== bitmap.width) target.width = bitmap.width;
            if (target.height !== bitmap.height) target.height = bitmap.height;
            target.getContext("2d")?.drawImage(bitmap, 0, 0);
            armTimeout();
          } finally {
            bitmap.close();
          }
        });
      } catch {
        if (!controller.signal.aborted || timedOut) errorHandler.current();
      } finally {
        clearTimeout(timeout);
      }
    }
    void stream();
    return () => { controller.abort(); clearTimeout(timeout); };
  }, [src]);
  return <canvas ref={canvas} role="img" aria-label={name} className="size-full object-contain" />;
}
