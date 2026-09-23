"use client";
import { useEffect, useId, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { Button } from "./ui/button";
import { cx } from "./ui/styles";
export default function Modal({
  title,
  onClose,
  children,
  size = "",
  busy = false,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  size?: "" | "small" | "medium";
  busy?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const dialog = ref.current;
    const previous = document.activeElement as HTMLElement | null;
    dialog?.showModal();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      dialog?.close();
      document.body.style.overflow = overflow;
      previous?.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className={cx("m-auto max-h-[calc(100dvh-40px)] rounded-2xl border-0 bg-white p-0 text-foreground shadow-[0_4px_10px_#0002] backdrop:bg-[#0005]", size === "small" ? "w-[min(470px,calc(100vw-32px))]" : size === "medium" ? "w-[min(854px,calc(100vw-32px))]" : "w-[min(1000px,calc(100vw-32px))]")}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget && !busy) {
          const box = event.currentTarget.getBoundingClientRect();
          if (
            event.clientX < box.left ||
            event.clientX > box.right ||
            event.clientY < box.top ||
            event.clientY > box.bottom
          )
            onClose();
        }
      }}
    >
      <header className="flex items-center justify-between gap-4 border-b border-[#e5e5e5] px-6 py-5 max-[600px]:p-4">
        <h2 id={titleId} className="text-[18px] font-semibold text-[#383838]">{title}</h2>
        <Button
          icon
          className="border-0! text-[#929cad]!"
          type="button"
          aria-label="Tutup dialog"
          onClick={onClose}
          disabled={busy}
        >
          <X size={20} />
        </Button>
      </header>
      {children}
    </dialog>
  );
}
