type Stream = Pick<EventSource, "onopen" | "onmessage" | "onerror" | "addEventListener" | "close">;

export function connectStatusStream<T>({
  url, refresh, receive, open, createStream = (url) => new EventSource(url),
  now = () => Date.now(),
  every = (callback, milliseconds) => setInterval(callback, milliseconds),
  cancel = (timer) => clearInterval(timer),
}: {
  url: string;
  refresh: (signal: AbortSignal) => Promise<unknown>;
  receive: (status: T) => void;
  open?: () => void;
  createStream?: (url: string) => Stream;
  now?: () => number;
  every?: (callback: () => void, milliseconds: number) => ReturnType<typeof setInterval>;
  cancel?: (timer: ReturnType<typeof setInterval>) => void;
}) {
  let closed = false;
  let polling = false;
  let lastSignal = now();
  let fallback: ReturnType<typeof setInterval> | null = null;
  let source: Stream | null = null;
  let activeRequest: AbortController | null = null;
  const poll = async () => {
    if (closed || polling) return;
    polling = true;
    const controller = new AbortController();
    activeRequest = controller;
    try { await refresh(controller.signal); } catch { /* The caller displays connection failures. */ }
    finally {
      if (activeRequest === controller) activeRequest = null;
      polling = false;
    }
  };
  const startFallback = () => {
    if (closed || fallback !== null) return;
    void poll();
    fallback = every(() => void poll(), 2000);
  };
  const recovered = () => {
    if (closed) return;
    lastSignal = now();
    activeRequest?.abort();
    if (fallback !== null) cancel(fallback);
    fallback = null;
  };
  try {
    source = createStream(url);
    source.onopen = () => { if (!closed) { lastSignal = now(); open?.(); } };
    source.onmessage = (event) => {
      if (closed) return;
      try {
        const payload = JSON.parse(event.data);
        if (payload?.result) { recovered(); receive(payload.result); }
        else startFallback();
      } catch { startFallback(); }
    };
    source.addEventListener("heartbeat", recovered);
    source.onerror = startFallback;
  } catch { startFallback(); }
  const watchdog = every(() => {
    if (now() - lastSignal > 10000) startFallback();
  }, 1000);
  return () => {
    closed = true;
    activeRequest?.abort();
    source?.close();
    cancel(watchdog);
    if (fallback !== null) cancel(fallback);
  };
}
