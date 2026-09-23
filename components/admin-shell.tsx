"use client";
import { useRef, useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { BrandLogo } from "./ui/brand-logo";
import { clearDashboardProfileCache, dashboardProfileRequest, defaultDashboardProfile, type DashboardProfile } from "./dashboard-profile";
import { usePathname, useRouter } from "next/navigation";
import {
  Cctv,
  Calendar,
  ChevronRight,
  LayoutDashboard,
  Menu,
  Settings2,
  LogOut,
} from "lucide-react";
const navigation = [
  {
    group: "Overview",
    links: [{ href: "/", label: "Dashboard", icon: LayoutDashboard }],
  },
  {
    group: "Manajemen Event",
    links: [{ href: "/events", label: "Event", icon: Calendar }],
  },
  {
    group: "Sistem",
    links: [
      { href: "/master-cctv", label: "Kamera", icon: Cctv },
      { href: "/settings", label: "Pengaturan", icon: Settings2 },
    ],
  },
];
const publicRoutes = [
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
];
export default function AdminShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const menu = useRef<HTMLDetailsElement>(null);
  const [authenticated, setAuthenticated] = useState(false);
  const [name, setName] = useState("Administrator");
  const [brand, setBrand] = useState(defaultDashboardProfile);
  useEffect(() => {
    if (!publicRoutes.includes(pathname)) document.title = brand.name;
  }, [brand.name, pathname]);
  useEffect(() => {
    const controller = new AbortController();
    if (localStorage.getItem("auth_token") && !publicRoutes.includes(pathname)) {
      dashboardProfileRequest(undefined, controller.signal).then(setBrand).catch(() => {});
    }
    function changed(event: Event) {
      controller.abort();
      setBrand((event as CustomEvent<DashboardProfile>).detail);
    }
    window.addEventListener("dashboard-profile-changed", changed);
    return () => {
      controller.abort();
      window.removeEventListener("dashboard-profile-changed", changed);
    };
  }, [pathname]);
  useEffect(() => {
    function syncProfile() {
      try {
        const user = JSON.parse(localStorage.getItem("user_info") || "null");
        setName(user?.full_name || "Administrator");
        if (
          !publicRoutes.includes(pathname) &&
          !localStorage.getItem("auth_token")
        ) {
          router.replace("/login");
          return;
        }
        setAuthenticated(true);
        if (
          user &&
          !user.account_type &&
          pathname !== "/onboarding" &&
          !publicRoutes.includes(pathname)
        )
          router.replace("/onboarding");
      } catch {
        router.replace("/login");
      }
    }
    syncProfile();
    window.addEventListener("profile-changed", syncProfile);
    return () => window.removeEventListener("profile-changed", syncProfile);
  }, [pathname, router]);
  function logout() {
    clearDashboardProfileCache();
    setBrand(defaultDashboardProfile);
    localStorage.removeItem("auth_token");
    localStorage.removeItem("user_info");
    setAuthenticated(false);
    router.push("/login");
  }
  if (publicRoutes.includes(pathname) || pathname === "/onboarding")
    return <>{children}</>;
  if (!authenticated)
    return (
      <div role="status" className="grid min-h-screen place-items-center">
        Memuat…
      </div>
    );
  const eventDetail = pathname.startsWith("/events/");
  const title = eventDetail
    ? "Detail Event"
    : pathname === "/events"
      ? "Daftar Event"
      : navigation
          .flatMap((group) => group.links)
          .find((link) => link.href === pathname)?.label || "Monitoring";
  const renderNavigation = () =>
    navigation.map((group) => (
      <div className="mb-[26px]" key={group.group}>
        <p className="mx-3 mb-[5px] text-[10px] tracking-[1px] text-[#cbd8f0] uppercase">{group.group}</p>
        {group.links.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className="mt-1 flex min-h-[45px] items-center gap-3 rounded-lg px-3 py-2.5 font-semibold text-white hover:bg-[#ffffff15] aria-[current]:bg-white aria-[current]:text-navy"
            aria-current={
              pathname === href || (href === "/events" && eventDetail)
                ? "page"
                : undefined
            }
            onClick={() => {
              if (menu.current) menu.current.open = false;
            }}
          >
            <Icon size={18} />
            <span>{label}</span>
          </Link>
        ))}
      </div>
    ));
  return (
    <div className="min-h-dvh bg-white scheme-light lg:pl-64">
      <a href="#page-content" className="fixed -top-[100px] left-4 z-100 bg-white p-3 text-navy focus:top-2.5">
        Lewati ke konten
      </a>
      <aside className="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:z-40 lg:flex lg:w-64 lg:flex-col lg:bg-navy lg:text-white">
        <Link href="/" className="flex min-h-[93px] items-center gap-3 border-b border-[#ffffff12] p-6">
          <BrandLogo name={brand.name} src={brand.logo} size="sidebar" />
          <span className="min-w-0">
            <strong className="block text-base [overflow-wrap:anywhere]">{brand.name}</strong>
            <small className="mt-1 block text-xs/normal text-[#e0e9fc]">Dashboard Monitoring</small>
          </span>
        </Link>
        <nav className="flex-1 overflow-y-auto px-4 py-[26px]" aria-label="Navigasi utama">{renderNavigation()}</nav>
        <div className="flex items-center gap-2.5 p-4">
          <Link
            href="/settings?tab=profile"
            className="grid size-8 place-items-center rounded-full border-2 border-white"
            aria-label="Profil pengguna"
          >
            {name.charAt(0).toUpperCase()}
          </Link>
          <Link href="/settings?tab=profile" className="min-w-0 flex-1">
            <strong className="block truncate text-xs/normal">{name}</strong>
            <small className="mt-0.5 block text-[10px]">Administrator</small>
          </Link>
          <button
            onClick={logout}
            className="grid size-8 place-items-center rounded-lg bg-white text-[#f23852]"
            aria-label="Keluar"
          >
            <LogOut size={16} />
          </button>
        </div>
      </aside>
      <header className="flex h-[72px] items-center gap-5 border-b border-line bg-white px-5 max-[600px]:h-auto max-[600px]:min-h-16 max-[600px]:gap-3 max-[600px]:px-4 max-[600px]:py-2.5 lg:px-8">
        <details
          ref={menu}
          className="relative lg:hidden"
          onKeyDown={(e) => {
            if (e.key === "Escape" && menu.current) {
              menu.current.open = false;
              menu.current.querySelector("summary")?.focus();
            }
          }}
        >
          <summary className="flex min-h-11 list-none items-center gap-1.5 [&::-webkit-details-marker]:hidden">
            <Menu size={20} /> Menu
          </summary>
          <nav className="absolute top-[50px] left-0 z-45 w-60 rounded-[10px] bg-navy px-4 py-5 text-white shadow-[0_8px_24px_#0003] [&>a]:block [&>a]:p-3 [&>button]:block [&>button]:p-3" aria-label="Navigasi mobile">
            {renderNavigation()}
            <Link href="/settings?tab=profile">Profil pengguna</Link>
            <button onClick={logout}>Keluar</button>
          </nav>
        </details>
        <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-2.5 text-sm/normal max-[600px]:gap-1 max-[600px]:text-xs/normal [&_a]:text-[#737373] [&_svg]:text-[#737373] [&_span]:font-semibold [&_span]:text-navy">
          <Link href="/">Workspace</Link>
          <ChevronRight size={16} />
          {eventDetail && (
            <>
              <Link href="/events">Daftar Event</Link>
              <ChevronRight size={16} />
            </>
          )}
          <span aria-current="page">{title}</span>
        </nav>
      </header>
      <div id="page-content" tabIndex={-1} className="min-w-0 outline-none">
        {children}
      </div>
    </div>
  );
}
