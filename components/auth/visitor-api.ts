import { toast } from "../ui/toast";

import { visitorFetch } from "./visitor-fetch";
export { visitorFetch } from "./visitor-fetch";

export async function downloadVisitorReport(url: string, filename: string) {
  try {
    const response = await visitorFetch(url);
    if (!response.ok) throw new Error("Report belum dapat diunduh. Coba lagi.");
    const objectUrl = URL.createObjectURL(await response.blob());
    const link = document.createElement("a");
    link.href = objectUrl;
    link.download = filename;
    link.click();
    setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    toast.success("Laporan berhasil disiapkan untuk diunduh.");
  } catch (error) {
    toast.error(error instanceof Error ? error.message : "Laporan gagal diunduh.");
    throw error;
  }
}
