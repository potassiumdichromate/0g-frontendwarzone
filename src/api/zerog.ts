const BASE = "https://zerog-zerodash.onrender.com";

async function req<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE}${path}`, options);
  if (!res.ok) {
    let err: Record<string, string> = {};
    try { err = await res.json(); } catch {}
    throw new Error(err?.detail || err?.error || err?.message || `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export function getNonce(wallet: string) {
  return req<{ wallet: string; nonce: string; message: string; issuedAt: string; expiresIn: number }>(
    `/auth/nonce?wallet=${wallet}`
  );
}

export function login(wallet: string, signature: string, nonce: string) {
  return req<{ token: string; wallet: string; expiresIn: number }>("/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ wallet, signature, nonce }),
  });
}

export async function loadBinary(jwt: string) {
  const res = await fetch(`${BASE}/player/load/binary`, {
    headers: { Authorization: `Bearer ${jwt}` },
  });
  if (!res.ok) {
    let err: Record<string, string> = {};
    try { err = await res.json(); } catch {}
    throw new Error(err?.error || `HTTP ${res.status}`);
  }
  const rootHash  = res.headers.get("X-Root-Hash") || "";
  const saveIndex = res.headers.get("X-Save-Index") || "";
  const daStatus  = res.headers.get("X-Da-Status") || "";
  const checksum  = res.headers.get("X-Checksum-Sha256") || "";
  const buffer    = await res.arrayBuffer();
  return { buffer, rootHash, saveIndex, daStatus, checksum };
}

export function getMetadata(wallet: string) {
  return req<{ wallet: string; saves: unknown[]; onChain: unknown }>(`/player/save/metadata?wallet=${wallet}`);
}

export function verify(wallet: string) {
  return req<{ wallet: string; saveIndex: number; layers: Record<string, boolean>; allPassed: boolean }>(
    `/player/verify?wallet=${wallet}`
  );
}

export function getDashboard(jwt: string) {
  return req<Record<string, unknown>>("/0g/dashboard", { headers: { Authorization: `Bearer ${jwt}` } });
}

export function getActivity(jwt: string, page = 1) {
  return req<Record<string, unknown>>(`/0g/activity?page=${page}&limit=20`, {
    headers: { Authorization: `Bearer ${jwt}` },
  });
}

export function getNetworkStatus() {
  return req<Record<string, unknown>>("/0g/network");
}
