export async function visitorFetch(input: RequestInfo | URL, init: RequestInit = {}) {
  const token = localStorage.getItem("auth_token");
  if (!token) throw new Error("Silakan masuk kembali untuk mengakses visitor.");
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${token}`);
  return fetch(input, { ...init, headers });
}

export async function downloadVisitorReport(url: string, filename: string) {
  const response = await visitorFetch(url);
  if (!response.ok) throw new Error("Report belum dapat diunduh. Coba lagi.");
  const objectUrl = URL.createObjectURL(await response.blob());
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
}
