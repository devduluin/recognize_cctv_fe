"use client";

import { useEffect, useRef, useState, type MouseEvent } from "react";

type Entry = { id: string; label: string };

export default function ManualGuideContents({ entries }: { entries: Entry[] }) {
  const [active, setActive] = useState(entries[0]?.id ?? "");
  const navigation = useRef<HTMLElement>(null);

  useEffect(() => {
    const headings = entries.map(entry => document.getElementById(entry.id)).filter((heading): heading is HTMLElement => !!heading);
    let frame = 0;
    const update = () => {
      frame = 0;
      let current: HTMLElement | undefined = headings[0];
      for (const heading of headings) {
        if (heading.getBoundingClientRect().top <= 128) current = heading;
        else break;
      }
      if (window.scrollY > 0 && window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) current = headings.at(-1);
      if (current) setActive(current.id);
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(update); };
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    window.addEventListener("hashchange", schedule);
    // Lazy-loaded screenshots can move section headings without a scroll event.
    const observer = new ResizeObserver(schedule);
    const article = document.getElementById("manual-guide-body");
    if (article) observer.observe(article);
    schedule();
    return () => {
      if (frame) cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      window.removeEventListener("hashchange", schedule);
    };
  }, [entries]);

  useEffect(() => {
    const nav = navigation.current;
    const link = nav?.querySelector<HTMLElement>('[aria-current="location"]');
    if (!nav || !link) return;
    const bounds = nav.getBoundingClientRect();
    const item = link.getBoundingClientRect();
    if (item.top < bounds.top || item.bottom > bounds.bottom) {
      nav.scrollTo({ top: nav.scrollTop + item.top - bounds.top - nav.clientHeight / 2 + item.height / 2,
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
    }
  }, [active]);

  function navigate(event: MouseEvent<HTMLAnchorElement>, id: string) {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const heading = document.getElementById(id);
    if (!heading) return;
    event.preventDefault();
    if (window.location.hash !== `#${id}`) window.history.pushState(null, "", `#${id}`);
    heading.focus({ preventScroll: true });
    heading.scrollIntoView({ block: "start", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
  }

  return <nav ref={navigation} aria-label="Daftar isi panduan" className="max-h-[min(60vh,640px)] overflow-y-auto overscroll-contain pr-2 xl:max-h-[calc(100dvh-7rem)]">
    <h2 className="mb-3 font-semibold text-navy">Daftar isi</h2>
    <ol className="space-y-1">{entries.map(entry => <li key={entry.id}>
      <a href={`#${entry.id}`} onClick={event => navigate(event, entry.id)} aria-current={active === entry.id ? "location" : undefined}
        className="block rounded-lg border-l-2 border-transparent px-3 py-2 text-sm text-muted transition-colors duration-200 hover:bg-slate-50 hover:text-navy aria-[current]:border-navy aria-[current]:bg-blue-50 aria-[current]:font-semibold aria-[current]:text-navy motion-reduce:transition-none">
        {entry.label}
      </a>
    </li>)}</ol>
  </nav>;
}
