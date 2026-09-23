# Komponen UI

Komponen di folder ini memakai utility Tailwind v4. Warna bersama (`navy`, `accent`, `muted`, `line`, `background`, `foreground`) dan font didefinisikan melalui `@theme` di `app/globals.css`. File global hanya memuat tema dan aturan dasar seperti fokus keyboard, checkbox mobile, dan reduced motion.

| Komponen | Kegunaan |
| --- | --- |
| `Page`, `PageHeading`, `Toolbar` | Lebar halaman, judul, serta filter dan aksi responsif |
| `Panel`, `InfoRow`, `Tabs` | Bagian pengaturan, rincian label/nilai, dan navigasi tab |
| `Button`, `ButtonLink` | Aksi native button dan navigasi Next Link dengan tampilan sama |
| `Field`, `Input`, `Select`, `Switch` | Form dengan label, kontrol, dan state native |
| `StatCard` | Metrik berikon, label, dan nilai |
| `TableContainer`, `DataTable`, `StatusBadge` | Tabel yang dapat digulir horizontal dan status baris |
| `ScrollArea` | Scroll lokal dengan dukungan keyboard; wajib beri `aria-label` atau `aria-labelledby` |
| `BrandLogo` | Logo unggahan atau inisial nama, ukuran `sidebar` dan `profile` |

Modal tetap menggunakan `components/ui-modal.tsx` untuk fokus, Escape, backdrop, dan penguncian scroll halaman. Styling modal sudah menggunakan Tailwind.

```tsx
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { Panel } from "@/components/ui/layout";

<Panel>
  <form onSubmit={save}>
    <Field>
      Nama
      <Input required value={name} onChange={(event) => setName(event.target.value)} />
    </Field>
    <Button variant="primary" type="submit" disabled={saving} className="mt-4">
      {saving ? "Menyimpan…" : "Simpan"}
    </Button>
  </form>
</Panel>
```

`Button` mendukung varian `default`, `primary`, `outline`, `play`, `pause`, `stop`, serta `icon`. Pertahankan `type="submit"` untuk submit form dan `type="button"` untuk aksi lainnya di dalam form. Untuk label upload atau summary yang perlu terlihat seperti tombol, gunakan `buttonStyles()` tanpa mengubah semantik elemennya.

`ui` di `styles.ts` menyediakan rangkaian utility bersama untuk elemen semantik seperti deskripsi, footer modal, dan menu baris. `cx()` hanya menggabungkan string class, tidak menyelesaikan konflik utility. Gunakan varian komponen terlebih dahulu; gunakan modifier penting Tailwind (`p-0!`, misalnya) jika benar-benar perlu mengganti default. Atribut `data-slot` dipakai untuk variasi dalam toolbar dan panel detail, bukan class CSS global.

Breakpoint 600, 700, 900, 1024, dan 1200px mengikuti tampilan sebelumnya. Tinggi baris teks dashboard mengikuti CSS semula agar konversi tidak mengubah jarak vertikal. Halaman autentikasi dan monitoring lama sudah memakai Tailwind, sehingga tampilannya dipertahankan.
