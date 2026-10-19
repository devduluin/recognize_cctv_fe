"use client";

import { Select } from "./field";

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
  return <fieldset disabled={disabled} className="min-w-0" data-slot="field">
    <legend className="mb-1.5 text-neutral-700">{label}</legend>
    <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2">
      <Select aria-label={`${label}: jam`} required={required} value={hour} onChange={event => onChange(`${event.target.value}:${minute}`)}>
        <option value="" disabled>Jam</option>
        {hours.map(option => <option key={option} value={option}>{option}</option>)}
      </Select>
      <span aria-hidden="true" className="text-neutral-500">:</span>
      <Select aria-label={`${label}: menit`} required={required} value={minute} onChange={event => onChange(`${hour}:${event.target.value}`)}>
        <option value="" disabled>Menit</option>
        {minutes.map(option => <option key={option} value={option}>{option}</option>)}
      </Select>
    </div>
  </fieldset>;
}
