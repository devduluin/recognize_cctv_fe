"use client";

import {
  useState,
  useRef,
  useEffect,
  useMemo,
  type MouseEvent as ReactMouseEvent,
} from "react";
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Check,
} from "lucide-react";
import { cx, ui } from "./styles";

type DateRangePickerProps = {
  startDate?: string | null;
  endDate?: string | null;
  onChange: (startDate: string, endDate: string) => void;
  className?: string;
  disabled?: boolean;
};

const MONTH_NAMES = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
];

const DAY_NAMES = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];

function formatYMD(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseYMD(str: string): Date {
  const parts = str.split("-").map(Number);
  if (parts.length === 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) {
    return new Date(parts[0], parts[1] - 1, parts[2]);
  }
  return new Date();
}

function formatDisplayDate(dateStr: string): string {
  try {
    const d = parseYMD(dateStr);
    return d.toLocaleDateString("id-ID", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
}

export function DateRangePicker({
  startDate,
  endDate,
  onChange,
  className,
  disabled = false,
}: DateRangePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  // Month being viewed in the calendar
  const [viewDate, setViewDate] = useState(() => {
    const d = startDate ? parseYMD(startDate) : new Date();
    return { year: d.getFullYear(), month: d.getMonth() };
  });
  const [prevStartDate, setPrevStartDate] = useState(startDate);

  // Sync viewed month when startDate changes (adjusting state during render)
  if (startDate !== prevStartDate) {
    setPrevStartDate(startDate);
    if (startDate) {
      const d = parseYMD(startDate);
      setViewDate({ year: d.getFullYear(), month: d.getMonth() });
    }
  }

  const { year: viewYear, month: viewMonth } = viewDate;

  // In-progress selection
  const [selectingStart, setSelectingStart] = useState<string | null>(null);
  const [hoveredDate, setHoveredDate] = useState<string | null>(null);

  // Click outside and Escape handling
  useEffect(() => {
    if (!isOpen) return;

    function handleClickOutside(e: MouseEvent | TouchEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
        setSelectingStart(null);
      }
    }

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setIsOpen(false);
        setSelectingStart(null);
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

  const activeStart = selectingStart || startDate || "";
  const activeEnd = selectingStart ? (hoveredDate && hoveredDate >= selectingStart ? hoveredDate : selectingStart) : (endDate || startDate || "");

  // Generate calendar days for viewed month
  const calendarDays = useMemo(() => {
    const firstDay = new Date(viewYear, viewMonth, 1).getDay();
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const daysInPrevMonth = new Date(viewYear, viewMonth, 0).getDate();

    const days: { dateStr: string; dayNum: number; isCurrentMonth: boolean }[] = [];

    // Prev month padding
    for (let i = firstDay - 1; i >= 0; i--) {
      const d = new Date(viewYear, viewMonth - 1, daysInPrevMonth - i);
      days.push({
        dateStr: formatYMD(d),
        dayNum: daysInPrevMonth - i,
        isCurrentMonth: false,
      });
    }

    // Current month days
    for (let i = 1; i <= daysInMonth; i++) {
      const d = new Date(viewYear, viewMonth, i);
      days.push({
        dateStr: formatYMD(d),
        dayNum: i,
        isCurrentMonth: true,
      });
    }

    // Next month padding to fill 35 or 42 cells
    const remaining = (7 - (days.length % 7)) % 7;
    for (let i = 1; i <= remaining; i++) {
      const d = new Date(viewYear, viewMonth + 1, i);
      days.push({
        dateStr: formatYMD(d),
        dayNum: i,
        isCurrentMonth: false,
      });
    }

    return days;
  }, [viewYear, viewMonth]);

  const handlePrevMonth = (e: ReactMouseEvent) => {
    e.stopPropagation();
    setViewDate((prev) =>
      prev.month === 0
        ? { year: prev.year - 1, month: 11 }
        : { year: prev.year, month: prev.month - 1 }
    );
  };

  const handleNextMonth = (e: ReactMouseEvent) => {
    e.stopPropagation();
    setViewDate((prev) =>
      prev.month === 11
        ? { year: prev.year + 1, month: 0 }
        : { year: prev.year, month: prev.month + 1 }
    );
  };

  const handleDateClick = (dateStr: string) => {
    if (!selectingStart) {
      // First click: select start date
      setSelectingStart(dateStr);
    } else {
      // Second click: finalize range
      if (dateStr < selectingStart) {
        onChange(dateStr, selectingStart);
      } else {
        onChange(selectingStart, dateStr);
      }
      setSelectingStart(null);
      setHoveredDate(null);
      setIsOpen(false);
    }
  };

  // Label calculation
  const rangeSummary = useMemo(() => {
    if (!startDate) return "Pilih rentang tanggal...";
    const startLabel = formatDisplayDate(startDate);
    const effEnd = endDate || startDate;
    if (effEnd === startDate) {
      return startLabel;
    }
    const endLabel = formatDisplayDate(effEnd);
    return `${startLabel} — ${endLabel}`;
  }, [startDate, endDate]);

  return (
    <div ref={containerRef} className={cx("relative w-full", className)}>
      {/* Trigger Field */}
      <button
        type="button"
        ref={triggerRef}
        disabled={disabled}
        onClick={() => setIsOpen((prev) => !prev)}
        className={cx(
          ui.input,
          "flex items-center justify-between gap-2.5 text-left cursor-pointer transition-colors hover:border-neutral-400 focus:outline-none focus:ring-2 focus:ring-navy/20",
          isOpen && "border-navy ring-2 ring-navy/20"
        )}
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <CalendarIcon size={16} className="text-navy shrink-0" />
          <span className="truncate text-sm font-medium text-neutral-800">
            {rangeSummary}
          </span>
        </div>
        <ChevronDown
          size={15}
          className={cx(
            "text-neutral-400 shrink-0 transition-transform duration-150",
            isOpen && "rotate-180 text-navy"
          )}
        />
      </button>

      {/* Popover Calendar */}
      <div
        className={cx(
          "absolute left-0 z-40 mt-1.5 w-full sm:w-[320px] rounded-xl border border-line bg-white p-3.5 shadow-[0_8px_28px_#0000001a] origin-top-left transition-all duration-150 ease-out",
          isOpen
            ? "opacity-100 scale-100 translate-y-0 visible pointer-events-auto"
            : "opacity-0 scale-95 -translate-y-1 invisible pointer-events-none"
        )}
      >
        {/* Month Navigation */}
        <div className="mb-2 flex items-center justify-between">
          <button
            type="button"
            onClick={handlePrevMonth}
            className="grid size-7 place-items-center rounded-lg border border-neutral-200 text-neutral-600 hover:bg-neutral-100 cursor-pointer transition-colors"
            aria-label="Bulan sebelumnya"
          >
            <ChevronLeft size={16} />
          </button>
          <span className="text-xs font-semibold text-neutral-800">
            {MONTH_NAMES[viewMonth]} {viewYear}
          </span>
          <button
            type="button"
            onClick={handleNextMonth}
            className="grid size-7 place-items-center rounded-lg border border-neutral-200 text-neutral-600 hover:bg-neutral-100 cursor-pointer transition-colors"
            aria-label="Bulan berikutnya"
          >
            <ChevronRight size={16} />
          </button>
        </div>

        {/* Day Header */}
        <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-semibold text-neutral-400 mb-1">
          {DAY_NAMES.map((d) => (
            <div key={d} className="py-1">
              {d}
            </div>
          ))}
        </div>

        {/* Calendar Grid */}
        <div className="grid grid-cols-7 gap-y-1">
          {calendarDays.map(({ dateStr, dayNum, isCurrentMonth }) => {
            const isStart = activeStart === dateStr;
            const isEnd = activeEnd === dateStr;
            const inRange =
              activeStart &&
              activeEnd &&
              dateStr > activeStart &&
              dateStr < activeEnd;

            return (
              <button
                key={dateStr}
                type="button"
                onClick={() => handleDateClick(dateStr)}
                onMouseEnter={() => {
                  if (selectingStart) setHoveredDate(dateStr);
                }}
                className={cx(
                  "relative flex size-8 items-center justify-center text-xs transition-colors cursor-pointer",
                  !isCurrentMonth && "text-neutral-300",
                  isCurrentMonth && !isStart && !isEnd && !inRange && "text-neutral-700 hover:bg-neutral-100 rounded-md",
                  (isStart || isEnd) && "bg-navy text-white font-semibold z-10",
                  isStart && isEnd && "rounded-md",
                  isStart && !isEnd && "rounded-l-md",
                  isEnd && !isStart && "rounded-r-md",
                  inRange && "bg-navy/10 text-navy font-medium"
                )}
              >
                {dayNum}
              </button>
            );
          })}
        </div>

        {/* Selection Status Prompt */}
        <div className="mt-3 border-t border-line pt-2.5 flex items-center justify-between text-[11px] text-neutral-500">
          <span>
            {selectingStart ? (
              <span className="text-amber-700 font-medium">Klik tanggal selesai...</span>
            ) : (
              <span>{rangeSummary}</span>
            )}
          </span>
          <button
            type="button"
            onClick={() => {
              if (selectingStart) {
                onChange(selectingStart, selectingStart);
                setSelectingStart(null);
              }
              setIsOpen(false);
            }}
            className="flex items-center gap-1 rounded bg-navy px-2.5 py-1 text-xs font-medium text-white hover:bg-navy/90 cursor-pointer"
          >
            <Check size={12} />
            Selesai
          </button>
        </div>
      </div>
    </div>
  );
}
