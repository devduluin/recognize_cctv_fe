import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import type { ReactNode } from "react";
import ManualGuideContents from "../../components/manual-guide-contents";
import { Page, PageHeading, Panel } from "../../components/ui/layout";

// React escapes source text. Only the small Markdown subset used by the manual is rendered.
function inline(text: string): ReactNode {
  return text.split(/(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g).map((part, index) => {
    if (part.startsWith("**")) return <strong key={index}>{part.slice(2, -2)}</strong>;
    if (part.startsWith("`")) return <code key={index} className="rounded bg-slate-100 px-1">{part.slice(1, -1)}</code>;
    const link = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(part);
    // Repository maintenance links do not belong to the application user flow.
    return link ? link[1] : part;
  });
}

export default async function ManualGuidePage() {
  const source = await readFile(path.join(process.cwd(), "docs/manual/README.md"), "utf8");
  const lines = source.split("\n");
  const contents: { id: string; label: string }[] = [];
  const blocks: ReactNode[] = [];
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index].trim();
    if (!line || line.startsWith("# ") || line.startsWith("**Status gambar:**") || line.startsWith("Untuk pengelola teknis,")) continue;
    if (line.startsWith("## ")) {
      const label = line.slice(3);
      const id = `bagian-${contents.length + 1}`;
      contents.push({ id, label });
      blocks.push(<h2 key={index} id={id} tabIndex={-1} className="mt-10 scroll-mt-6 border-t border-line pt-6 text-xl font-semibold text-navy">{label}</h2>);
    } else if (line.startsWith("### ")) {
      blocks.push(<h3 key={index} className="mt-6 text-base font-semibold text-navy">{line.slice(4)}</h3>);
    } else if (line.startsWith("|")) {
      const rows: string[][] = [];
      const key = index;
      while (index < lines.length && lines[index].startsWith("|")) {
        if (!/^\|[ :|-]+\|$/.test(lines[index])) rows.push(lines[index].split("|").slice(1, -1).map(cell => cell.trim()));
        index++;
      }
      index--;
      blocks.push(<div key={key} className="my-4 overflow-x-auto" tabIndex={0} role="region" aria-label={rows[0]?.join(", ")}>
        <table className="w-full border-collapse text-left text-sm">
          <thead><tr>{rows[0]?.map((cell, column) => <th key={column} scope="col" className="border border-line bg-slate-50 p-3">{inline(cell)}</th>)}</tr></thead>
          <tbody>{rows.slice(1).map((row, rowIndex) => <tr key={rowIndex}>{row.map((cell, column) => <td key={column} className="border border-line p-3 align-top">{inline(cell)}</td>)}</tr>)}</tbody>
        </table>
      </div>);
    } else if (/^\d+\. /.test(line)) {
      const items: string[] = [];
      const key = index;
      while (index < lines.length && /^\d+\. /.test(lines[index])) items.push(lines[index++].replace(/^\d+\. /, ""));
      index--;
      blocks.push(<ol key={key} className="my-4 list-decimal space-y-2 pl-6">{items.map((item, itemIndex) => <li key={itemIndex}>{inline(item)}</li>)}</ol>);
    } else if (line.startsWith("![")) {
      const image = /^!\[([^\]]*)\]\(screenshots\/([\w-]+\.png)\)$/.exec(line);
      if (image && existsSync(path.join(process.cwd(), "public/manual/screenshots", image[2]))) {
        blocks.push(<figure key={index} className="my-6">
          {/* Documentation screenshots retain their original dimensions. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`/manual/screenshots/${image[2]}`} alt={image[1]} loading="lazy" className="h-auto w-full rounded-lg border border-line" />
          <figcaption className="mt-2 text-xs text-muted">{image[1]} · Data contoh</figcaption>
        </figure>);
      }
    } else {
      blocks.push(<p key={index} className="my-3">{inline(line)}</p>);
    }
  }
  return <Page>
    <PageHeading><div><h1>Manual Guide</h1><p className="mt-2 text-muted">Panduan lengkap penggunaan Visitor Counter, dari persiapan hingga sinkronisasi.</p></div></PageHeading>
    <div className="grid items-start gap-6 xl:grid-cols-[250px_minmax(0,1fr)]">
      <Panel className="xl:sticky xl:top-6"><ManualGuideContents entries={contents} /></Panel>
      <Panel className="min-w-0"><article id="manual-guide-body" className="max-w-4xl text-sm leading-7" aria-label="Panduan penggunaan aplikasi">{blocks}</article></Panel>
    </div>
  </Page>;
}
