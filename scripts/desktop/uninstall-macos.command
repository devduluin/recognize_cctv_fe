#!/bin/zsh
# Visitor Counter only. Source repositories and other desktop apps are untouched.
set -eu

mode=''
dry_run=false
for argument in "$@"; do
  case "$argument" in
    --keep-data|--purge-data)
      if [[ -n "$mode" ]]; then print -u2 'Pilih satu mode penghapusan.'; exit 2; fi
      mode="$argument" ;;
    --dry-run) dry_run=true ;;
    *) print -u2 'Penggunaan: zsh uninstall-macos.command --keep-data|--purge-data [--dry-run]'; exit 2 ;;
  esac
done
if [[ -z "$mode" ]]; then
  print -u2 'Wajib memilih --keep-data (simpan data) atau --purge-data (hapus seluruh data lokal).'
  exit 2
fi
if [[ "$(uname -s)" != 'Darwin' ]]; then print -u2 'Script ini khusus macOS.'; exit 2; fi
if [[ -z "${HOME:-}" || "$HOME" == '/' || ! -d "$HOME/Library" ]]; then print -u2 'Direktori pengguna tidak valid.'; exit 2; fi

support="$HOME/Library/Application Support/Visitor Counter"
targets=(
  '/Applications/Visitor Counter.app'
  "$HOME/Applications/Visitor Counter.app"
  "$HOME/Library/Caches/com.duluin.visitorcounter"
  "$HOME/Library/Caches/Visitor Counter"
  "$HOME/Library/Preferences/com.duluin.visitorcounter.plist"
  "$HOME/Library/Saved Application State/com.duluin.visitorcounter.savedState"
  "$HOME/Library/Logs/Visitor Counter"
  "$HOME/Library/HTTPStorages/com.duluin.visitorcounter"
  "$HOME/Library/WebKit/com.duluin.visitorcounter"
)
if [[ "$mode" == '--purge-data' ]]; then
  targets+=("$support")
else
  for cache in 'Cache' 'Code Cache' 'GPUCache' 'GPUPersistentCache' 'DawnGraphiteCache' 'DawnWebGPUCache' 'GraphiteDawnCache' 'next-runtime'; do
    targets+=("$support/$cache")
  done
fi

if $dry_run; then
  print 'Preview saja; tidak ada file yang diubah:'
  for target in "${targets[@]}"; do
    if [[ -e "$target" || -L "$target" ]]; then print -r -- "$target"; fi
  done
  exit 0
fi

if /usr/bin/pgrep -f '/Visitor Counter[.]app/Contents/' >/dev/null; then
  print -u2 'Visitor Counter masih berjalan. Tutup dengan Command+Q, tunggu layanan berhenti, lalu jalankan kembali.'
  exit 1
fi

# Move to a dedicated Trash folder, so partial failures remain recoverable.
stamp="$(date +%Y%m%d-%H%M%S)-$$"
trash="$HOME/.Trash/Visitor-Counter-uninstall-$stamp"
mkdir -p "$trash"
index=0
failed=false
for target in "${targets[@]}"; do
  if [[ ! -e "$target" && ! -L "$target" ]]; then continue; fi
  # Verify identity before removing an application with this name.
  if [[ "$target" == *.app ]]; then
    bundle_id=$(/usr/libexec/PlistBuddy -c 'Print :CFBundleIdentifier' "$target/Contents/Info.plist" 2>/dev/null || true)
    if [[ "$bundle_id" != 'com.duluin.visitorcounter' ]]; then
      print -u2 -r -- "Dilewati: identitas aplikasi tidak cocok: $target"
      failed=true
      continue
    fi
  fi
  index=$((index + 1))
  destination="$trash/$index-${target:t}"
  if mv "$target" "$destination"; then
    print -r -- "Dipindahkan ke Trash: $target"
  else
    print -u2 -r -- "Gagal memindahkan: $target. Periksa izin folder melalui Finder."
    failed=true
  fi
done
if $failed; then
  print -u2 -r -- "Uninstall belum lengkap. File yang sudah dipindahkan tersedia di: $trash"
  exit 1
fi
print -r -- "Uninstall selesai. File dipindahkan ke: $trash"
if [[ "$mode" == '--keep-data' ]]; then
  print -r -- "Database, rekaman, akun, dan sesi tetap disimpan di: $support"
else
  print 'Data lokal aktif sudah dibersihkan. Salinan di Trash masih bisa dipulihkan sampai Anda mengosongkannya.'
fi
print 'Source code, artifact build, aplikasi lain, entri Local Network, dan item Keychain tidak diubah.'
