import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export function StatCard({ label, value, icon: Icon }: { label: string; value: ReactNode; icon: LucideIcon }) {
  return (
    <div className="flex min-h-[91px] items-center justify-between gap-3 rounded-[13px] border-t-[3px] border-accent bg-[linear-gradient(110deg,#f9fbff,white)] p-4 shadow-[0_2px_7px_#00000016]">
      <Icon className="size-[34px] shrink-0 text-accent" strokeWidth={1.4} />
      <div className="min-w-0 text-right">
        <p className="text-xs leading-[1.4] text-[#595959] uppercase">{label}</p>
        <strong className="mt-[7px] block text-[21px] font-semibold text-[#383838] [overflow-wrap:anywhere]">{value}</strong>
      </div>
    </div>
  );
}
