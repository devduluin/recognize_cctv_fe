import Image from "next/image";

export function BrandLogo({ name, src, size = "profile" }: { name: string; src: string; size?: "sidebar" | "profile" }) {
  const sidebar = size === "sidebar";
  if (src) return <Image unoptimized src={src} alt={sidebar ? "" : "Logo dashboard"} width={sidebar ? 32 : 112} height={sidebar ? 40 : 112} className={sidebar ? "h-10 w-8 shrink-0 object-contain" : "size-28 object-contain"} />;
  return <span role={sidebar ? undefined : "img"} aria-hidden={sidebar || undefined} aria-label={sidebar ? undefined : "Inisial dashboard"} className={`inline-grid shrink-0 place-items-center rounded-lg bg-[#e0e9fc] font-semibold text-[#183b70] ${sidebar ? "h-10 w-8 text-xl/normal" : "size-28 text-[40px]"}`}>{name.trim().charAt(0).toUpperCase() || "D"}</span>;
}
