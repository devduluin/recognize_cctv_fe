import Link from "next/link";
import type { ComponentProps } from "react";
import { cx } from "./styles";

type Variant = "default" | "primary" | "outline" | "play" | "pause" | "stop";
type ButtonStyleProps = { variant?: Variant; icon?: boolean; className?: string };
const variants: Record<Variant, string> = {
  default: "border-line bg-white text-navy hover:bg-[#f3f6fa]",
  primary: "border-navy bg-navy text-white hover:bg-[#17448c]",
  outline: "border-navy bg-white text-navy hover:bg-[#f3f6fa]",
  play: "border-[#168548] bg-[#168548] text-white",
  pause: "border-[#b78648] bg-[#fff9ec] text-[#875000]",
  stop: "border-[#de2029] bg-[#de2029] text-white",
};

export function buttonStyles({ variant = "default", icon = false, className }: ButtonStyleProps = {}) {
  return cx("inline-flex min-h-[38px] items-center justify-center gap-2 rounded-lg border py-2 text-sm/normal font-medium whitespace-nowrap max-[600px]:min-h-11", icon ? "w-10 px-2" : "px-4", variants[variant], className);
}

export function Button({ variant, icon, className, ...props }: ComponentProps<"button"> & ButtonStyleProps) {
  return <button {...props} data-slot="button" className={buttonStyles({ variant, icon, className })} />;
}

export function ButtonLink({ variant, icon, className, ...props }: ComponentProps<typeof Link> & ButtonStyleProps) {
  return <Link {...props} data-slot="button" className={buttonStyles({ variant, icon, className })} />;
}
