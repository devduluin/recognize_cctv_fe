"use client";

import { Search, X } from "lucide-react";
import { useDeferredValue, useEffect, useMemo, useRef, useState, type MouseEvent, type ReactNode } from "react";

type Entry = { id: string; label: string };
export type SearchEntry = { id: string; title: string; section: string; text: string };

const lower = (value: string) => value.toLocaleLowerCase("id");
const terms = (query: string) => lower(query).split(/\s+/).filter(term => term.length > 1);

function snippet(text: string, words: string[]): ReactNode {
  const source = lower(text);
  const at = Math.max(0, source.indexOf(words[0]));
  const start = Math.max(0, at - 50);
  const excerpt = `${start ? "…" : ""}${text.slice(start, at + 110).trim()}${at + 110 < text.length ? "…" : ""}`;
  const pattern = new RegExp(`(${words.map(word => word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`, "gi");
  return excerpt.split(pattern).map((part, index) => index % 2 ? <mark key={index} className="rounded-sm bg-amber-200 px-0.5 text-inherit">{part}</mark> : part);
}

/** Highlight matches in the article without changing its DOM (CSS Custom Highlight API). */
function highlightArticle(words: string[]) {
  const registry = (globalThis as { CSS?: { highlights?: Map<string, unknown> } }).CSS?.highlights;
  const HighlightClass = (globalThis as { Highlight?: new (...ranges: Range[]) => unknown }).Highlight;
  if (!registry || !HighlightClass) return;
  registry.delete("manual-search");
  const article = document.getElementById("manual-guide-body");
  if (!article || !words.length) return;
  const ranges: Range[] = [];
  const walker = document.createTreeWalker(article, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node && ranges.length < 500; node = walker.nextNode()) {
    const text = lower(node.textContent ?? "");
    for (const word of words) {
      for (let at = text.indexOf(word); at >= 0; at = text.indexOf(word, at + word.length)) {
        const range = document.createRange();
        range.setStart(node, at);
        range.setEnd(node, at + word.length);
        ranges.push(range);
      }
    }
  }
  registry.set("manual-search", new HighlightClass(...ranges));
}

export default function ManualGuideContents({ entries, searchIndex = [] }: { entries: Entry[]; searchIndex?: SearchEntry[] }) {
  const [active, setActive] = useState(entries[0]?.id ?? "");
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const navigation = useRef<HTMLElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const words = useMemo(() => terms(deferredQuery), [deferredQuery]);
  const results = useMemo(() => {
    if (!words.length) return [];
    // Every word must match; headings outrank body text, then frequency, then document order.
    const occurrences = (text: string, word: string) => text.split(word).length - 1;
    return searchIndex
      .map((entry, order) => {
        const title = lower(entry.title);
        const body = lower(entry.text);
        if (!words.every(word => title.includes(word) || body.includes(word))) return null;
        const score = words.reduce((total, word) => total + (title.includes(word) ? 20 : 0) + Math.min(occurrences(body, word), 10), 0);
        return { entry, score, order };
      })
      .filter((item): item is { entry: SearchEntry; score: number; order: number } => item !== null)
      .sort((a, b) => b.score - a.score || a.order - b.order)
      .map(item => item.entry);
  }, [searchIndex, words]);

  useEffect(() => { highlightArticle(words); }, [words]);
  useEffect(() => () => highlightArticle([]), []);

  useEffect(() => {
    // "/" jumps to search, as in common documentation sites.
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (event.key !== "/" || event.metaKey || event.ctrlKey || target?.closest("input, textarea, select, [contenteditable=true]")) return;
      event.preventDefault();
      input.current?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

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
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || !document.getElementById(id)) return;
    event.preventDefault();
    jump(id);
  }

  function jump(id: string) {
    const heading = document.getElementById(id);
    if (!heading) return;
    if (window.location.hash !== `#${id}`) window.history.pushState(null, "", `#${id}`);
    heading.focus({ preventScroll: true });
    heading.scrollIntoView({ block: "start", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
  }

  const searching = words.length > 0;
  return <nav ref={navigation} aria-label="Daftar isi panduan" className="max-h-[min(60vh,640px)] overflow-y-auto overscroll-contain pr-2 xl:max-h-[calc(100dvh-7rem)]">
    <div role="search" className="sticky top-0 z-10 -mx-1 mb-3 bg-white px-1 pb-2">
      <label htmlFor="manual-search" className="sr-only">Cari di panduan</label>
      <div className="relative">
        <Search size={16} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted" aria-hidden="true" />
        <input
          ref={input}
          id="manual-search"
          type="search"
          value={query}
          placeholder="Cari panduan…"
          autoComplete="off"
          aria-describedby="manual-search-status"
          onChange={event => setQuery(event.target.value)}
          onKeyDown={event => {
            if (event.key === "Escape") setQuery("");
            if (event.key === "Enter" && results[0]) { event.preventDefault(); jump(results[0].id); }
          }}
          className="h-10 w-full rounded-lg border border-[#cfd8e3] bg-white pr-16 pl-9 text-sm text-foreground shadow-[0_1px_2px_#1426410d] transition-[border-color,box-shadow] placeholder:text-[#8a97ab] hover:border-[#9fadc0] focus:border-navy focus:ring-3 focus:ring-navy/15 focus-visible:outline-hidden [&::-webkit-search-cancel-button]:hidden"
        />
        {query ? (
          <button type="button" onClick={() => { setQuery(""); input.current?.focus(); }} aria-label="Hapus pencarian" className="absolute top-1/2 right-2 grid size-7 -translate-y-1/2 place-items-center rounded-md text-muted hover:bg-slate-100 hover:text-navy">
            <X size={15} aria-hidden="true" />
          </button>
        ) : <kbd className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 rounded border border-line bg-slate-50 px-1.5 text-[11px] text-muted" aria-hidden="true">/</kbd>}
      </div>
      <p id="manual-search-status" aria-live="polite" className={searching && results.length ? "mt-2 text-xs text-muted" : "sr-only"}>
        {searching ? (results.length ? `${results.length} bagian cocok` : "Tidak ada hasil") : "Tekan / untuk mencari"}
      </p>
    </div>
    {searching ? (results.length ? <ol className="space-y-1" aria-label="Hasil pencarian">{results.map(result => <li key={result.id}>
      <a href={`#${result.id}`} onClick={event => navigate(event, result.id)}
        className="block rounded-lg px-3 py-2 text-sm transition-colors hover:bg-slate-50 focus-visible:bg-blue-50">
        {result.section !== result.title && <span className="block text-[11px] text-muted">{result.section}</span>}
        <span className="block font-semibold text-navy">{result.title}</span>
        <span className="mt-0.5 line-clamp-3 text-xs leading-relaxed text-muted">{snippet(result.text || result.title, words)}</span>
      </a>
    </li>)}</ol> : <div className="rounded-lg border border-dashed border-line px-3 py-4 text-center text-sm text-muted">
      <p>Tidak ada hasil untuk “{deferredQuery.trim()}”.</p>
      <p className="mt-1 text-xs">Coba kata lain, misalnya “kamera” atau “sinkronisasi”.</p>
    </div>) : <>
    <h2 className="mb-3 font-semibold text-navy">Daftar isi</h2>
    <ol className="space-y-1">{entries.map(entry => <li key={entry.id}>
      <a href={`#${entry.id}`} onClick={event => navigate(event, entry.id)} aria-current={active === entry.id ? "location" : undefined}
        className="block rounded-lg border-l-2 border-transparent px-3 py-2 text-sm text-muted transition-colors duration-200 hover:bg-slate-50 hover:text-navy aria-[current]:border-navy aria-[current]:bg-blue-50 aria-[current]:font-semibold aria-[current]:text-navy motion-reduce:transition-none">
        {entry.label}
      </a>
    </li>)}</ol>
    </>}
  </nav>;
}
