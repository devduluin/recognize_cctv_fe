import type { ComponentProps } from "react";
import { cx, ui } from "./styles";

export function Field({ className, ...props }: ComponentProps<"label">) {
  return <label {...props} data-slot="field" className={cx(ui.field, className)} />;
}

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input {...props} data-slot="input" className={cx(ui.input, className)} />;
}

export function Select({ className, ...props }: ComponentProps<"select">) {
  return <select {...props} data-slot="input" className={cx(ui.input, className)} />;
}

export function Switch({ className, ...props }: Omit<ComponentProps<"input">, "type">) {
  return <input {...props} type="checkbox" role="switch" className={cx("h-6 w-12 cursor-pointer appearance-none rounded-3xl bg-[#a0aec0] p-[3px] checked:bg-[#009b72] before:block before:size-[18px] before:rounded-full before:bg-white before:transition-transform before:duration-150 before:content-[''] checked:before:translate-x-6", className)} />;
}
