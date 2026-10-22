"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Modal from "../ui-modal";
import { Button } from "./button";
import { ui } from "./styles";

type Options = { title: string; message: string; confirmLabel: string };

// Use an application dialog: WKWebView does not provide browser confirm UI.
export function useConfirmation() {
  const [options, setOptions] = useState<Options | null>(null);
  const pending = useRef<((confirmed: boolean) => void) | null>(null);
  useEffect(() => () => { pending.current?.(false); pending.current = null; }, []);
  const finish = useCallback((confirmed: boolean) => {
    const resolve = pending.current;
    pending.current = null;
    setOptions(null);
    resolve?.(confirmed);
  }, []);
  const confirm = useCallback((next: Options) => new Promise<boolean>(resolve => {
    if (pending.current) { resolve(false); return; }
    pending.current = resolve;
    setOptions(next);
  }), []);
  const confirmation = options ? <Modal title={options.title} size="small" onClose={() => finish(false)}>
    <div className={ui.modalBody}><p>{options.message}</p></div>
    <footer className={ui.modalFooter}>
      <Button type="button" autoFocus onClick={() => finish(false)}>Batal</Button>
      <Button type="button" variant="primary" onClick={() => finish(true)}>{options.confirmLabel}</Button>
    </footer>
  </Modal> : null;
  return { confirm, confirmation };
}
