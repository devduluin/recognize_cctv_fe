"use client";

import { cx, ui } from "./styles";

const hours = Array.from({ length: 24 }, (_, hour) => String(hour).padStart(2, "0"));
const minutes = Array.from({ length: 60 }, (_, minute) => String(minute).padStart(2, "0"));

export function TimePicker({ label, value, onChange, required = false, disabled = false }: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  disabled?: boolean;
}) {
  const [hour = "", minute = ""] = value.split(":");
  return <fieldset disabled={disabled} className="min-w-0 text-[#444]" data-slot="field">
    <legend className="mb-1.5">{label}</legend>
    <div data-slot="input" className={cx(ui.input, "grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center !p-0 focus-within:ring-2 focus-within:ring-navy focus-within:ring-offset-1")}>
      <select className="min-h-[38px] min-w-0 w-full cursor-pointer rounded-lg border-0 bg-transparent px-3 py-2 text-sm/normal text-[#333] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-navy disabled:cursor-not-allowed" aria-label={`${label}: jam`} required={required} value={hour} onChange={event => onChange(`${event.target.value}:${minute}`)}>
        <option value="" disabled>Jam</option>
        {hours.map(option => <option key={option} value={option}>{option}</option>)}
      </select>
      <span aria-hidden="true" className="text-neutral-500">:</span>
      <select className="min-h-[38px] min-w-0 w-full cursor-pointer rounded-lg border-0 bg-transparent px-3 py-2 text-sm/normal text-[#333] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-navy disabled:cursor-not-allowed" aria-label={`${label}: menit`} required={required} value={minute} onChange={event => onChange(`${hour}:${event.target.value}`)}>
        <option value="" disabled>Menit</option>
        {minutes.map(option => <option key={option} value={option}>{option}</option>)}
      </select>
    </div>
  </fieldset>;
}
