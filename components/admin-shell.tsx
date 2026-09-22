"use client";

import { useRef, useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Camera, Calendar, ChevronRight, LayoutDashboard, Menu, ScanFace, Settings2, Bell, Search, User, LogOut, ChevronDown } from "lucide-react";

const navigation = [
  { group: "Utama", links: [{ href: "/", label: "Dashboard", icon: LayoutDashboard }] },
  { group: "Event Visitor", links: [
    { href: "/events", label: "Manajemen Event", icon: Calendar }
  ] },
  { group: "Absen CCTV", links: [
    { href: "/recognize_cctv", label: "Monitoring Absensi", icon: Camera },
    { href: "/master-cctv", label: "Master CCTV", icon: ScanFace }
  ] },
  { group: "Sistem", links: [{ href: "/settings", label: "Pengaturan", icon: Settings2 }] }
];

export default function AdminShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const menu = useRef<HTMLDetailsElement>(null);
  
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [monitorMode, setMonitorMode] = useState<"" | "visitor" | "attendance" | "both" | null>(null);
  const [monitorModeLoading, setMonitorModeLoading] = useState(true);
  
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (pathname === "/login" || pathname === "/register" || pathname === "/forgot-password" || pathname === "/reset-password") {
      setIsAuthenticated(true);
      return;
    }
    const token = localStorage.getItem("auth_token");
    if (!token) {
      router.push("/login");
    } else {
      setIsAuthenticated(true);
      try {
        const userInfoStr = localStorage.getItem("user_info");
        if (userInfoStr) {
          const user = JSON.parse(userInfoStr);
          if (!user.account_type && pathname !== "/onboarding") {
            router.push("/onboarding");
          } else if (user.account_type && pathname === "/onboarding") {
            router.push("/");
          }
        }
      } catch {}
    }
  }, [pathname, router]);

  useEffect(() => {
    if (pathname === "/login" || pathname === "/register" || pathname === "/forgot-password" || pathname === "/reset-password" || pathname === "/onboarding") return;

    const cachedMode = localStorage.getItem("monitor_mode");
    if (cachedMode === "" || cachedMode === "visitor" || cachedMode === "attendance" || cachedMode === "both") {
      setMonitorMode(cachedMode);
    }

    const loadMonitorMode = async () => {
      try {
        const user = JSON.parse(localStorage.getItem("user_info") || "null");
        const companyId = user?.account_type === "personal" ? user?.id : user?.company_id;
        if (!companyId) return;
        const response = await fetch(`${process.env.NEXT_PUBLIC_SERVICE_RECOGNIZE_CCTV || ""}/api/v1/cctv/runtime/settings?company_id=${encodeURIComponent(companyId)}`);
        if (!response.ok) return;
        const payload = await response.json();
        const mode = payload.result?.monitor_mode;
        if (mode === "" || mode === "visitor" || mode === "attendance" || mode === "both") {
          localStorage.setItem("monitor_mode", mode);
          setMonitorMode(mode);
        }
      } catch {} finally {
        setMonitorModeLoading(false);
      }
    };

    const handleMonitorModeChanged = (event: Event) => {
      const mode = (event as CustomEvent).detail;
      if (mode === "" || mode === "visitor" || mode === "attendance" || mode === "both") {
        localStorage.setItem("monitor_mode", mode);
        setMonitorMode(mode);
      }
    };

    loadMonitorMode();
    window.addEventListener("monitor-mode-changed", handleMonitorModeChanged);
    return () => window.removeEventListener("monitor-mode-changed", handleMonitorModeChanged);
  }, [pathname]);
  
  const activeGroup = navigation.find((group) => group.links.some((link) => link.href === pathname));
  const activeLink = activeGroup?.links.find((link) => link.href === pathname);

  const handleLogout = () => {
    localStorage.removeItem("auth_token");
    localStorage.removeItem("user_info");
    router.push("/login");
  };

  if (pathname === "/login" || pathname === "/register" || pathname === "/forgot-password" || pathname === "/reset-password" || pathname === "/onboarding") return <>{children}</>;
  if (!isAuthenticated) return <div className="min-h-screen flex items-center justify-center">Memuat...</div>;

  const visibleNavigation = monitorMode === "visitor" || monitorMode === ""
    ? navigation.filter((group) => group.group !== "Absen CCTV")
    : navigation;

  const renderNavigation = (mobile = false) => {
    if (monitorModeLoading && monitorMode === null) {
      return <div className="space-y-5 px-3" aria-label="Memuat navigasi" aria-busy="true">
        {["w-24", "w-36", "w-28"].map((width, index) => (
          <div key={index} className="space-y-2">
            <div className={`h-2.5 animate-pulse rounded bg-slate-200 ${width}`} />
            <div className="h-10 animate-pulse rounded-lg bg-slate-100" />
          </div>
        ))}
      </div>;
    }
    return visibleNavigation.map((group) => (
    <div key={group.group} className="mb-6 last:mb-0">
      <p className={`mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.16em] ${mobile ? "text-slate-400" : "text-slate-500"}`}>{group.group}</p>
      {group.links.map(({ href, label, icon: Icon }) => {
        const active = pathname === href;
        return (
          <Link key={href} href={href} aria-current={active ? "page" : undefined}
            onClick={() => { if (menu.current) menu.current.open = false; }}
            className={`mt-1 flex items-center gap-3 rounded-lg px-3 py-3 text-sm transition-colors ${active ? mobile ? "bg-indigo-50 font-medium text-indigo-700" : "bg-indigo-500/15 font-medium text-indigo-300 ring-1 ring-inset ring-indigo-500/20" : mobile ? "text-slate-600 hover:bg-slate-50" : "text-slate-400 hover:bg-white/5 hover:text-white"}`}>
            <Icon size={18} className="shrink-0" /><span>{label}</span>
          </Link>
        );
      })}
    </div>
    ));
  };

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 lg:pl-64" style={{ colorScheme: "light" }}>
      <a href="#page-content" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-white focus:p-3 focus:text-indigo-700">Lewati ke konten</a>
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col bg-slate-950 lg:flex">
        <Link href="/" className="flex items-center gap-3 border-b border-white/10 px-6 py-6">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500 text-white"><ScanFace size={23} /></span>
          <span><span className="block font-semibold tracking-tight text-white">Vision Admin</span><span className="mt-1 block text-xs text-slate-500">Monitoring & management</span></span>
        </Link>
        <nav aria-label="Navigasi utama" className="flex-1 overflow-y-auto px-4 py-6">{renderNavigation()}</nav>
        <div className="m-4 rounded-xl border border-white/10 bg-white/5 p-4">
          <p className="text-sm font-medium text-white">Satu pusat kontrol</p>
          <p className="mt-2 text-xs leading-relaxed text-slate-400">Kelola monitoring pengunjung dan absensi CCTV dari workspace ini.</p>
        </div>
        <p className="border-t border-white/10 px-6 py-4 text-xs text-slate-500">Computer Vision · Control Center</p>
      </aside>
      <header className="sticky top-0 z-30 flex min-h-18 items-center justify-between gap-4 border-b border-slate-200 bg-white/95 px-4 py-3.5 backdrop-blur-md sm:px-8">
        <div className="flex min-w-0 items-center gap-4">
          <details ref={menu} className="relative lg:hidden" onKeyDown={(event) => { if (event.key === "Escape" && menu.current) { menu.current.open = false; menu.current.querySelector("summary")?.focus(); } }}>
            <summary aria-label="Buka navigasi" className="flex cursor-pointer list-none rounded-lg border border-slate-200 bg-slate-50 p-2 text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 [&::-webkit-details-marker]:hidden"><Menu size={20} /></summary>
            <nav aria-label="Navigasi mobile" className="absolute left-0 top-14 max-h-[75vh] w-64 overflow-y-auto rounded-xl border border-slate-200 bg-white p-3 shadow-xl">{renderNavigation(true)}</nav>
          </details>
          <nav aria-label="Breadcrumb" className="flex min-w-0 flex-wrap items-center gap-2 text-xs font-medium sm:text-sm">
            <Link href="/" className="text-slate-500 hover:text-indigo-600 transition-colors">Workspace</Link>
            {pathname !== "/" && <><ChevronRight size={14} className="text-slate-400" /><span className="hidden text-slate-500 sm:inline">{activeGroup?.group}</span><ChevronRight size={14} className="hidden text-slate-400 sm:inline" /></>}
            <span className="text-slate-900">{activeLink?.label ?? "Halaman tidak ditemukan"}</span>
          </nav>
        </div>
        
        <div className="flex items-center gap-3 sm:gap-5">
          <div className="hidden relative md:block group">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 transition-colors group-focus-within:text-indigo-500" />
            <input type="search" placeholder="Cari..." className="h-9 w-48 rounded-full border border-slate-200 bg-slate-50 pl-9 pr-4 text-xs transition-all focus:w-64 focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20" />
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <button type="button" aria-label="Notifikasi" className="relative flex h-9 w-9 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20">
              <Bell size={18} />
              <span className="absolute right-2.5 top-2 h-1.5 w-1.5 rounded-full bg-red-500 ring-2 ring-white"></span>
            </button>
            
            <div className="hidden h-6 w-px bg-slate-200 sm:block"></div>

            <details className="relative group">
              <summary className="flex cursor-pointer list-none items-center gap-2.5 rounded-full p-1 pr-3 transition-colors hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 [&::-webkit-details-marker]:hidden">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-500 text-xs font-bold text-white shadow-sm ring-2 ring-white">
                  {typeof window !== "undefined" && localStorage.getItem("user_info") 
                    ? (JSON.parse(localStorage.getItem("user_info") || "{}").full_name?.charAt(0).toUpperCase() || "A")
                    : "A"}
                </div>
                <div className="hidden flex-col items-start sm:flex">
                  <span className="text-xs font-bold text-slate-700">
                    {typeof window !== "undefined" && localStorage.getItem("user_info") 
                      ? (JSON.parse(localStorage.getItem("user_info") || "{}").full_name || "Admin Workspace")
                      : "Admin Workspace"}
                  </span>
                  <span className="text-[10px] font-medium text-slate-500">Administrator</span>
                </div>
                <ChevronDown size={14} className="hidden text-slate-400 transition-transform group-open:rotate-180 sm:block" />
              </summary>
              <div className="absolute right-0 top-[calc(100%+8px)] w-56 origin-top-right rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg outline-none">
                <div className="border-b border-slate-100 px-3 py-2 sm:hidden">
                   <p className="text-sm font-semibold text-slate-900">
                      {typeof window !== "undefined" && localStorage.getItem("user_info") 
                        ? (JSON.parse(localStorage.getItem("user_info") || "{}").full_name || "Admin Workspace")
                        : "Admin Workspace"}
                   </p>
                   <p className="text-xs text-slate-500">Administrator</p>
                </div>
                <Link href="/settings" className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900">
                  <Settings2 size={16} className="text-slate-400" /> Pengaturan Akun
                </Link>
                <button onClick={handleLogout} className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-red-600 transition-colors hover:bg-red-50 hover:text-red-700">
                  <LogOut size={16} className="text-red-500" /> Keluar (Logout)
                </button>
              </div>
            </details>
          </div>
        </div>
      </header>
      <div id="page-content" tabIndex={-1} className="min-w-0 outline-none">{children}</div>
    </div>
  );
}
