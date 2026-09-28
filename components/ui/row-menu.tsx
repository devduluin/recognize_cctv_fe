"use client";

import {
  useState,
  useRef,
  useEffect,
  type ReactNode,
  type MouseEvent as ReactMouseEvent,
} from "react";
import { MoreHorizontal } from "lucide-react";
import { cx } from "./styles";

type RowMenuProps = {
  children: ReactNode;
  trigger?: ReactNode;
  triggerAriaLabel?: string;
  className?: string;
  contentClassName?: string;
};

export function RowMenu({
  children,
  trigger,
  triggerAriaLabel,
  className,
  contentClassName,
}: RowMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    function handleClickOutside(event: MouseEvent | TouchEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
        triggerRef.current?.focus();
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const [openUpward, setOpenUpward] = useState(false);

  const handleTriggerClick = (e: ReactMouseEvent) => {
    e.stopPropagation();
    if (!isOpen && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      setOpenUpward(spaceBelow < 180);
    }
    setIsOpen((prev) => !prev);
  };

  return (
    <div ref={containerRef} className={cx("relative inline-block text-left", className)}>
      <button
        type="button"
        ref={triggerRef}
        aria-expanded={isOpen}
        aria-haspopup="menu"
        aria-label={triggerAriaLabel || "Aksi"}
        onClick={handleTriggerClick}
        className={
          trigger
            ? "cursor-pointer"
            : "grid size-9 place-items-center rounded border border-line bg-white text-neutral-700 hover:bg-neutral-50 hover:text-neutral-900 transition-colors focus:outline-none focus:ring-2 focus:ring-navy/20 max-[600px]:size-11 cursor-pointer"
        }
      >
        {trigger || <MoreHorizontal size={18} />}
      </button>

      <div
        role="menu"
        className={cx(
          "absolute right-0 z-30 w-[150px] rounded-lg border border-line bg-white p-[5px] shadow-[0_4px_16px_#00000014]",
          "transition-all duration-150 ease-out",
          openUpward
            ? "bottom-full mb-1 origin-bottom-right"
            : "top-full mt-1 origin-top-right",
          isOpen
            ? "opacity-100 scale-100 translate-y-0 pointer-events-auto visible"
            : openUpward
              ? "opacity-0 scale-95 translate-y-1 pointer-events-none invisible"
              : "opacity-0 scale-95 -translate-y-1 pointer-events-none invisible",
          contentClassName
        )}
        onClick={() => {
          setIsOpen(false);
        }}
      >
        <div className="[&>*]:block [&>*]:w-full [&>*]:rounded [&>*]:p-2.5 [&>*]:text-left [&>*]:text-xs [&>*]:font-medium [&>*]:text-neutral-700 [&>*:hover]:bg-[#f0f4f8] [&>*:hover]:text-neutral-900 [&>*.text-red-700]:text-red-600 [&>*.text-red-700:hover]:bg-red-50 [&>*.text-red-700:hover]:text-red-700 transition-colors">
          {children}
        </div>
      </div>
    </div>
  );
}
