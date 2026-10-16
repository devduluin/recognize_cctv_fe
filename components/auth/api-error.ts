/** Accept both FastAPI errors and the application's response envelope. */
export function apiErrorMessage(payload: unknown, status: number, fallback: string): string {
  // Unexpected server errors can contain SQL parameters or camera credentials.
  if (status >= 500) return `${fallback} Layanan mengalami gangguan (HTTP ${status}). Periksa log aplikasi.`;
  if (!payload || typeof payload !== "object") return `${fallback} (HTTP ${status})`;
  const body = payload as { detail?: unknown; message?: unknown; errors?: unknown };
  const message = typeof body.detail === "string" ? body.detail : typeof body.message === "string" ? body.message : "";
  const errors = Array.isArray(body.detail) ? body.detail : Array.isArray(body.errors) ? body.errors : [];
  const validation = errors.flatMap((error: unknown) => {
    if (!error || typeof error !== "object") return [];
    const item = error as { loc?: unknown; msg?: unknown };
    if (typeof item.msg !== "string") return [];
    const location = Array.isArray(item.loc) ? item.loc.filter(value => typeof value === "string" && !["body", "query"].includes(value)).join(".") : "";
    return [location ? `${location}: ${item.msg}` : item.msg];
  }).slice(0, 3).join("; ");
  return (validation || message || `${fallback} (HTTP ${status})`).replace(/(?:rtsp|rtsps):\/\/[^\s]+/gi, "[alamat kamera]");
}
