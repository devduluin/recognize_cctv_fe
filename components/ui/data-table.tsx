import type { ComponentProps } from "react";
import { cx, ui } from "./styles";

export function TableContainer({ className, ...props }: ComponentProps<"div">) {
  return <div {...props} className={cx(ui.tableWrap, className)} />;
}

export function DataTable({ className, ...props }: ComponentProps<"table">) {
  return <table {...props} className={cx(ui.table, className)} />;
}

export function StatusBadge({ className, ...props }: ComponentProps<"span">) {
  return <span {...props} className={cx(ui.statusBadge, className)} />;
}
