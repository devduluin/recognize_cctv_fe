"use client";

import { ToastContainer, toast as notify, type Id } from "react-toastify";

export type ToastType = "success" | "error" | "warning" | "info";

export function dismissToast(id?: Id) {
  notify.dismiss(id);
}

export function createToast(message: string, type: ToastType = "info", duration = 4000) {
  return notify(message, {
    type,
    autoClose: duration > 0 ? duration : false,
    role: type === "error" ? "alert" : "status",
  });
}

export const toast = Object.assign(
  (message: string, duration?: number) => createToast(message, "info", duration),
  {
    success: (message: string, duration?: number) => createToast(message, "success", duration),
    error: (message: string, duration?: number) => createToast(message, "error", duration),
    warning: (message: string, duration?: number) => createToast(message, "warning", duration),
    info: (message: string, duration?: number) => createToast(message, "info", duration),
    dismiss: dismissToast,
  },
);

export function Toaster() {
  return (
    <ToastContainer
      position="bottom-right"
      autoClose={4000}
      limit={3}
      hideProgressBar
      pauseOnHover
      pauseOnFocusLoss
      theme="light"
      aria-label="Notifikasi sistem. Tekan Alt+T untuk membuka notifikasi."
    />
  );
}
