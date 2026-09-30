"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertCircle, AlertTriangle, CheckCircle2, Info, X } from "lucide-react";

export type ToastType = "success" | "error" | "warning" | "info";

export interface ToastItem {
  id: string;
  message: string;
  type: ToastType;
  duration?: number;
}

type ToastListener = (toasts: ToastItem[]) => void;

let toasts: ToastItem[] = [];
const listeners = new Set<ToastListener>();

function notify() {
  listeners.forEach((listener) => listener([...toasts]));
}

export function dismissToast(id: string) {
  toasts = toasts.filter((t) => t.id !== id);
  notify();
}

export function createToast(
  message: string,
  type: ToastType = "info",
  duration = 4000,
) {
  const id = Math.random().toString(36).substring(2, 9);
  const newToast: ToastItem = { id, message, type, duration };
  toasts = [...toasts, newToast];
  notify();

  if (duration > 0) {
    setTimeout(() => {
      dismissToast(id);
    }, duration);
  }

  return id;
}

export const toast = Object.assign(
  (message: string, duration?: number) => createToast(message, "info", duration),
  {
    success: (message: string, duration?: number) =>
      createToast(message, "success", duration),
    error: (message: string, duration?: number) =>
      createToast(message, "error", duration),
    warning: (message: string, duration?: number) =>
      createToast(message, "warning", duration),
    info: (message: string, duration?: number) =>
      createToast(message, "info", duration),
    dismiss: dismissToast,
  },
);

export function Toaster() {
  const [currentToasts, setCurrentToasts] = useState<ToastItem[]>([]);

  useEffect(() => {
    listeners.add(setCurrentToasts);
    return () => {
      listeners.delete(setCurrentToasts);
    };
  }, []);

  return (
    <div
      aria-live="polite"
      aria-label="Notifikasi sistem"
      className="fixed bottom-5 right-5 z-[9999] flex flex-col gap-2.5 w-[calc(100vw-32px)] max-w-[400px] pointer-events-none max-[600px]:bottom-3 max-[600px]:right-4"
    >
      <AnimatePresence mode="popLayout">
        {currentToasts.map((item) => {
          const isError = item.type === "error";
          const isSuccess = item.type === "success";
          const isWarning = item.type === "warning";

          return (
            <motion.div
              key={item.id}
              layout
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.15 } }}
              role={isError ? "alert" : "status"}
              className="pointer-events-auto flex items-start gap-3 rounded-xl border border-[#e2e8f0] bg-white p-3.5 shadow-[0_4px_16px_rgba(0,0,0,0.08)] text-slate-800 text-sm font-medium"
            >
              <div className="mt-0.5 shrink-0">
                {isSuccess && (
                  <CheckCircle2 className="size-4.5 text-emerald-600" />
                )}
                {isError && <AlertCircle className="size-4.5 text-rose-600" />}
                {isWarning && (
                  <AlertTriangle className="size-4.5 text-amber-600" />
                )}
                {!isSuccess && !isError && !isWarning && (
                  <Info className="size-4.5 text-sky-600" />
                )}
              </div>

              <div className="flex-1 min-w-0 leading-snug break-words">
                {item.message}
              </div>

              <button
                type="button"
                onClick={() => dismissToast(item.id)}
                aria-label="Tutup notifikasi"
                className="shrink-0 -mr-1 -mt-1 p-1 text-slate-400 hover:text-slate-700 rounded-md transition-colors"
              >
                <X className="size-4" />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
