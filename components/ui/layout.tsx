import type { ComponentProps } from "react";
import { cx, ui } from "./styles";

export function Page({ className, ...props }: ComponentProps<"main">) {
  return <main {...props} className={cx(ui.page, className)} />;
}

export function PageHeading({ className, ...props }: ComponentProps<"div">) {
  return <div {...props} className={cx(ui.pageHeading, className)} />;
}

export function Panel({ className, ...props }: ComponentProps<"section">) {
  return <section {...props} data-slot="panel" className={cx(ui.panel, className)} />;
}

export function Toolbar({ className, ...props }: ComponentProps<"div">) {
  return <div {...props} data-slot="toolbar" className={cx(ui.toolbar, className)} />;
}

export function InfoRow({ className, ...props }: ComponentProps<"div">) {
  return <div {...props} className={cx(ui.infoRow, className)} />;
}

export function Tabs({ className, ...props }: ComponentProps<"nav">) {
  return <nav {...props} data-slot="tabs" className={cx(ui.tabs, className)} />;
}

export function ScrollArea({ className, ...props }: ComponentProps<"div">) {
  return <div role="region" tabIndex={0} {...props} className={cx("overflow-auto overscroll-contain [scrollbar-gutter:stable] focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-navy", className)} />;
}
