# Komponen UI

Komponen di folder ini memakai utility Tailwind v4. Warna bersama (`navy`, `accent`, `muted`, `line`, `background`, `foreground`) dan font didefinisikan melalui `@theme` di `app/globals.css`. File global hanya memuat tema dan aturan dasar seperti fokus keyboard, checkbox mobile, dan reduced motion.

| Komponen | Kegunaan |
| --- | --- |
| `Page`, `PageHeading`, `Toolbar` | Lebar halaman, judul, serta filter dan aksi responsif |
| `Panel`, `InfoRow`, `Tabs` | Bagian pengaturan, rincian label/nilai, dan navigasi tab |
| `Button`, `ButtonLink` | Aksi native button dan navigasi Next Link dengan tampilan sama |
| `Field`, `Input`, `Select`, `Switch` | Form dengan label, kontrol, dan state native. `Field` menerima `label`, `hint`, `error`, dan `optional`; saat memakai `error`, beri juga `aria-invalid` pada kontrol agar border-nya merah |
| `FieldHint`, `FieldError`, `FieldSet` | Teks bantuan, pesan validasi, dan grup kontrol dengan `legend` |
| `Checkbox` | Checkbox native; dengan `label` menjadi baris yang bisa diklik, tanpa `label` wajib `aria-label` (mis. pilih baris tabel) |
| `ChoiceCard` | Kartu pilihan checkbox/radio berisi `title` dan `description`; varian `card`, `compact`, `subtle` |
| `Range`, `SwitchField`, `FileButton` | Slider, baris label + switch, dan tombol pemilih file |
| `TimePicker` | Pilihan jam 00–23 dan menit 00–59; nilai lengkap berformat `HH:mm`, mendukung validasi wajib dan disabled |
| `StatCard` | Metrik berikon, label, dan nilai |
| `TableContainer`, `DataTable`, `StatusBadge` | Tabel yang dapat digulir horizontal dan status baris |
| `ScrollArea` | Scroll lokal dengan dukungan keyboard; wajib beri `aria-label` atau `aria-labelledby` |
| `BrandLogo` | Logo unggahan atau inisial nama, ukuran `sidebar` dan `profile` |

Modal tetap menggunakan `components/ui-modal.tsx` untuk fokus, Escape, backdrop, dan penguncian scroll halaman. Styling modal sudah menggunakan Tailwind.

```tsx
import { Button } from "@/components/ui/button";
import { Checkbox, ChoiceCard, Field, Input } from "@/components/ui/field";
import { Panel } from "@/components/ui/layout";

<Panel>
  <form onSubmit={save}>
    <Field label="Nama" hint="Tampil di daftar pengguna.">
      <Input required value={name} onChange={(event) => setName(event.target.value)} />
    </Field>
    <Field label="Kapasitas" optional>
      <Input type="number" min="1" value={capacity} onChange={(event) => setCapacity(event.target.value)} />
    </Field>
    <ChoiceCard title="Jalankan otomatis" description="Mulai sesuai jadwal." checked={autoRun} onChange={(event) => setAutoRun(event.target.checked)} />
    <Checkbox label="Akun aktif" checked={active} onChange={(event) => setActive(event.target.checked)} />
    <Button variant="primary" type="submit" disabled={saving} className="mt-4">
      {saving ? "Menyimpan…" : "Simpan"}
    </Button>
  </form>
</Panel>
```

`Button` mendukung varian `default`, `primary`, `outline`, `play`, `pause`, `stop`, serta `icon`. Pertahankan `type="submit"` untuk submit form dan `type="button"` untuk aksi lainnya di dalam form. Untuk label upload atau summary yang perlu terlihat seperti tombol, gunakan `buttonStyles()` tanpa mengubah semantik elemennya.

`ui` di `styles.ts` menyediakan rangkaian utility bersama untuk elemen semantik seperti deskripsi, footer modal, dan menu baris. `cx()` hanya menggabungkan string class, tidak menyelesaikan konflik utility. Gunakan varian komponen terlebih dahulu; gunakan modifier penting Tailwind (`p-0!`, misalnya) jika benar-benar perlu mengganti default. Atribut `data-slot` dipakai untuk variasi dalam toolbar dan panel detail, bukan class CSS global.

Breakpoint 600, 700, 900, 1024, dan 1200px mengikuti tampilan sebelumnya. Tinggi baris teks dashboard mengikuti CSS semula agar konversi tidak mengubah jarak vertikal. Halaman autentikasi dan monitoring lama sudah memakai Tailwind, sehingga tampilannya dipertahankan.
