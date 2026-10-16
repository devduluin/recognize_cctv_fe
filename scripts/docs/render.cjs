const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');
const output = path.join(root, 'artifacts/manual');
const source = fs.readFileSync(path.join(root, 'docs/manual/README.md'), 'utf8');
const escape = text => text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
function inline(text) {
  return escape(text)
    .replace(/!\[([^\]]*)\]\((screenshots\/[\w-]+\.png)\)/g, '<figure><img src="$2" alt="$1"><figcaption>$1 · Data contoh</figcaption></figure>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, label, href) => {
      if (href === 'capture.md') return label + ' (lihat capture.md dalam sumber repository)';
      if (href === '../windows-exe-build.md') return label + ' (lihat docs/windows-exe-build.md dalam sumber repository)';
      if (/^https:\/\//i.test(href)) return `<a href="${href}" rel="noreferrer">${label}</a>`;
      return label;
    })
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/`([^`]+)`/g, '<code>$1</code>');
}
let list = false, table = false;
const html = [];
const close = () => { if (list) { html.push('</ol>'); list = false; } if (table) { html.push('</tbody></table>'); table = false; } };
for (const line of source.split('\n')) {
  if (!line.trim()) { close(); continue; }
  if (line.startsWith('|')) {
    if (/^\|[ :|-]+\|$/.test(line)) continue;
    if (!table) { close(); html.push('<table><tbody>'); table = true; }
    html.push('<tr>' + line.split('|').slice(1, -1).map(cell => `<td>${inline(cell.trim())}</td>`).join('') + '</tr>');
  } else if (/^\d+\. /.test(line)) {
    if (!list) { close(); html.push('<ol>'); list = true; }
    html.push(`<li>${inline(line.replace(/^\d+\. /, ''))}</li>`);
  } else {
    close();
    const heading = /^(#{1,3}) (.+)$/.exec(line);
    html.push(heading ? `<h${heading[1].length}>${inline(heading[2])}</h${heading[1].length}>` : `<div class="paragraph">${inline(line)}</div>`);
  }
}
close();
fs.mkdirSync(output, { recursive: true });
fs.copyFileSync(path.join(root, 'docs/manual/README.md'), path.join(output, 'README.md'));
fs.writeFileSync(path.join(output, 'index.html'), `<!doctype html><html lang="id"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Panduan Visitor Counter</title><style>
body{font:16px/1.7 system-ui,sans-serif;color:#172334;background:#fff;max-width:1000px;margin:auto;padding:40px}h1,h2,h3{line-height:1.25;color:#193a59}h2{margin-top:48px;border-top:1px solid #dde3e8;padding-top:24px}table{width:100%;border-collapse:collapse;margin:18px 0}td{border:1px solid #dce3e9;padding:10px;vertical-align:top}tr:first-child{font-weight:bold;background:#edf3f7}figure{margin:24px 0}img{width:100%;height:auto;border:1px solid #dce3e9}figcaption{font-size:13px;color:#526477}li{padding:3px 0}.paragraph{margin:12px 0}code{background:#f0f3f5;padding:2px 4px}h1,h2,h3{break-after:avoid}figure,tr{break-inside:avoid}@media print{body{font-size:11px;padding:0}h2{margin-top:24px}img{max-height:155mm;object-fit:contain}}
</style><main>${html.join('\n')}</main></html>`);
console.log('Panduan HTML dibuat di artifacts/manual/index.html');
module.exports = { output, root };
