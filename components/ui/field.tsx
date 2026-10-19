import { useId, type ComponentProps, type ReactNode } from "react";
import { buttonStyles } from "./button";
import { cx, ui } from "./styles";

type FieldProps = ComponentProps<"label"> & {
  label?: ReactNode;
  hint?: ReactNode;
  /** Validation message; also set `aria-invalid` on the control to highlight it. */
  error?: ReactNode;
  optional?: boolean;
};

export function Field({ label, hint, error, optional = false, className, children, ...props }: FieldProps) {
  return <label {...props} data-slot="field" className={cx(ui.field, className)}>
    {label !== undefined && <span className="font-medium">
      {label}{optional && <span className="font-normal text-muted"> (opsional)</span>}
    </span>}
    {children}
    {error ? <FieldError>{error}</FieldError> : hint && <FieldHint>{hint}</FieldHint>}
  </label>;
}

export function FieldHint({ className, ...props }: ComponentProps<"span">) {
  return <span {...props} className={cx("text-xs leading-relaxed text-muted", className)} />;
}

export function FieldError({ className, ...props }: ComponentProps<"span">) {
  return <span role="alert" {...props} className={cx("text-xs font-medium leading-relaxed text-red-600", className)} />;
}

export function FieldSet({ legend, className, children, ...props }: ComponentProps<"fieldset"> & { legend: ReactNode }) {
  return <fieldset {...props} data-slot="field" className={cx("min-w-0 text-[#3b4658]", className)}>
    <legend className="mb-1.5 font-medium">{legend}</legend>
    {children}
  </fieldset>;
}

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input {...props} data-slot="input" className={cx(ui.input, className)} />;
}

export function Select({ className, ...props }: ComponentProps<"select">) {
  return <select {...props} data-slot="input" className={cx(ui.input, ui.selectChevron, className)} />;
}

export function Range({ className, ...props }: Omit<ComponentProps<"input">, "type">) {
  return <input {...props} type="range" className={cx("min-h-11 w-full cursor-pointer accent-navy", className)} />;
}

export function Switch({ className, ...props }: Omit<ComponentProps<"input">, "type">) {
  return <input {...props} type="checkbox" role="switch" className={cx("h-6 w-12 shrink-0 cursor-pointer appearance-none rounded-3xl bg-[#a0aec0] p-[3px] transition-colors duration-150 checked:bg-[#009b72] before:block before:size-[18px] before:rounded-full before:bg-white before:shadow-[0_1px_2px_#0003] before:transition-transform before:duration-150 before:content-[''] checked:before:translate-x-6 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy disabled:cursor-not-allowed disabled:opacity-50", className)} />;
}

/** Label and switch on one row; `className` styles the row. */
export function SwitchField({ label, className, ...props }: Omit<ComponentProps<"input">, "type"> & { label: ReactNode }) {
  return <label data-slot="field" className={cx("flex min-h-10 min-w-0 cursor-pointer items-center justify-between gap-3 text-[#3b4658] has-disabled:cursor-not-allowed has-disabled:text-[#8a97ab]", className)}>
    {label}
    <Switch {...props} />
  </label>;
}

/** Native checkbox. With `label`, `className` styles the clickable row; without it, the input itself. */
export function Checkbox({ label, className, ...props }: Omit<ComponentProps<"input">, "type"> & { label?: ReactNode }) {
  if (label === undefined) return <input {...props} type="checkbox" className={cx("cursor-pointer accent-navy disabled:cursor-not-allowed", className)} />;
  return <label className={cx("flex min-h-11 cursor-pointer items-center gap-3 text-sm text-[#3b4658] has-disabled:cursor-not-allowed has-disabled:opacity-60", className)}>
    <input {...props} type="checkbox" className="size-4 shrink-0 cursor-pointer accent-navy disabled:cursor-not-allowed" />
    {label}
  </label>;
}

type ChoiceVariant = "card" | "compact" | "subtle";
const choiceLayouts: Record<ChoiceVariant, string> = {
  card: "min-h-11 items-start p-4",
  compact: "min-h-14 items-center px-3 py-3",
  subtle: "min-h-11 items-start border border-transparent bg-[#f6f8fb] p-3",
};

/** Selectable card for a checkbox or radio with a title and optional description. */
export function ChoiceCard({ title, description, children, variant = "card", type = "checkbox", checked, className, ...props }: Omit<ComponentProps<"input">, "type" | "title"> & {
  title: ReactNode;
  description?: ReactNode;
  variant?: ChoiceVariant;
  type?: "checkbox" | "radio";
}) {
  const descriptionId = useId();
  const large = variant === "card";
  return <label className={cx(
    "flex cursor-pointer gap-3 rounded-lg transition-[border-color,background-color,box-shadow] duration-150 has-focus-visible:ring-3 has-focus-visible:ring-navy/25 has-disabled:cursor-not-allowed has-disabled:opacity-60",
    choiceLayouts[variant],
    variant !== "subtle" && "border",
    variant !== "subtle" && (checked ? "border-navy bg-[#f0f4fb] shadow-[inset_0_0_0_1px_var(--color-navy)]" : "border-[#cfd8e3] bg-white hover:border-[#9fadc0] hover:bg-[#fafbfd]"),
    className,
  )}>
    <input
      {...props}
      type={type}
      checked={checked}
      aria-describedby={description ? descriptionId : undefined}
      className={cx("shrink-0 cursor-pointer accent-navy focus-visible:outline-hidden disabled:cursor-not-allowed", large ? "mt-0.5 size-5" : "size-4", variant === "subtle" && "mt-0.5")}
    />
    <span className="min-w-0">
      <span className="block break-words font-medium text-foreground">{title}</span>
      {description && <span id={descriptionId} className={cx("block text-[#52647f]", large ? "mt-1 text-sm leading-relaxed" : "mt-0.5 text-xs leading-relaxed")}>{description}</span>}
      {children}
    </span>
  </label>;
}

/** Button-styled label that opens the native file picker. */
export function FileButton({ children, className, ...props }: Omit<ComponentProps<"input">, "type">) {
  return <label className={buttonStyles({ variant: "outline", className: cx("cursor-pointer", className) })}>
    {children}
    <input {...props} type="file" className="sr-only" />
  </label>;
}

export { DateRangePicker } from "./date-range-picker";
