export async function visitorFetch(input: RequestInfo | URL, init: RequestInit = {}) {
  const token = localStorage.getItem("auth_token");
  if (!token) throw new Error("Silakan masuk kembali untuk mengakses visitor.");
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${token}`);
  return fetch(input, { ...init, headers });
}
