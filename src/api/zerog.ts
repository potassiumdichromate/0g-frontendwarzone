const BASE = "https://zerog-warzonewarriors.onrender.com";

export const ZG_JWT_KEY = 'ZGJwt';

async function req<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE}${path}`, options);
  if (!res.ok) {
    let err: Record<string, string> = {};
    try { err = await res.json(); } catch {}
    throw new Error(err?.detail || err?.error || err?.message || `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

function auth(jwt: string): RequestInit {
  return { headers: { Authorization: `Bearer ${jwt}` } };
}

// ── Types ─────────────────────────────────────────────────────────────────

export interface Pipeline {
  stored:    { done: boolean };
  anchored:  { done: boolean };
  finalized: { done: boolean };
  validated: { done: boolean };
}

export interface TrustScore {
  score: number;
  label: 'bronze' | 'silver' | 'gold' | 'platinum';
  description: string;
}

export interface SaveSummary {
  totalSaves: number;
  finalizedSaves: number;
  anchoredSaves: number;
  totalDataStored: string;
}

export interface LatestSave {
  saveIndex: number;
  rootHash: string;
  coinSnapshot: number;
  fileSize: string;
  pipeline: Pipeline;
}

export interface Badge {
  label: 'bronze' | 'silver' | 'gold' | 'platinum';
  score: number;
  description: string;
  unlockedAt: string;
  criteria: { minScore: number; minSaves: number };
}

export interface ActivityEvent {
  id: string;
  type: string;
  title: string;
  status: string;
  timestamp: string;
  explorerUrl?: string;
}

export interface SaveRecord {
  saveIndex: number;
  rootHash: string;
  onChainTxHash?: string;
  coinSnapshot: number;
  fileSize: string;
  timestamp: string;
  daStatus?: string;
  pipeline: Pipeline;
}

export interface GlobalStats {
  totalPlayers: number;
  totalSaves: number;
  totalDataStored: string;
  finalizedSaves: number;
  anchoredSaves: number;
  averageTrustScore: number;
  lastUpdated: string;
}

export interface ComputeStats {
  totalSessions: number;
  analyzedSessions: number;
  flaggedSessions: number;
  anomalyRate: number;
  lastProcessed: string;
}

export interface ServiceStatus {
  label: string;
  status: 'online' | 'configured' | 'connecting' | 'offline';
  latencyMs?: number;
}

export interface NetworkStatus {
  overall: string;
  services: Record<string, ServiceStatus>;
  lastChecked: string;
}

export interface LeaderboardEntry {
  rank: number;
  wallet: string;
  username?: string;
  score: number;
  trustScore: number;
  trustBadge: string;
  verifiedSaves: number;
  lastSave: string;
}

export interface ProofData {
  wallet: string;
  saveIndex: number;
  rootHash: string;
  onChainTxHash?: string;
  daRootHash?: string;
  timestamp: string;
  valid: boolean;
}

// ── Auth ──────────────────────────────────────────────────────────────────

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

// ── Save: Binary ──────────────────────────────────────────────────────────

export async function loadBinary(jwt: string) {
  const res = await fetch(`${BASE}/player/load/binary`, {
    headers: { Authorization: `Bearer ${jwt}` },
  });
  if (!res.ok) {
    let err: Record<string, string> = {};
    try { err = await res.json(); } catch {}
    throw new Error(err?.error || `HTTP ${res.status}`);
  }
  return {
    buffer:    await res.arrayBuffer(),
    rootHash:  res.headers.get("X-Root-Hash")       || "",
    saveIndex: res.headers.get("X-Save-Index")      || "",
    daStatus:  res.headers.get("X-Da-Status")        || "",
    checksum:  res.headers.get("X-Checksum-Sha256") || "",
  };
}

export function getMetadata(wallet: string) {
  return req<{ wallet: string; saves: SaveRecord[]; onChain: unknown }>(`/player/save/metadata?wallet=${wallet}`);
}

export function verify(wallet: string) {
  return req<{ wallet: string; saveIndex: number; layers: Record<string, boolean>; allPassed: boolean }>(
    `/player/verify?wallet=${wallet}`
  );
}

// ── 0G Dashboard: Authenticated ───────────────────────────────────────────

export function getDashboard(jwt: string) {
  return req<{ trustScore: TrustScore; summary: SaveSummary; latestSave: LatestSave | null }>(
    "/0g/dashboard", auth(jwt)
  );
}

export function getBadge(jwt: string) {
  return req<{ badge: Badge }>("/0g/badge", auth(jwt));
}

export function getActivity(jwt: string, page = 1) {
  return req<{ events: ActivityEvent[]; page: number; totalPages: number; total: number }>(
    `/0g/activity?page=${page}&limit=20`, auth(jwt)
  );
}

export function getPlayerHistory(jwt: string) {
  return req<{ wallet: string; saves: SaveRecord[] }>("/0g/player/history", auth(jwt));
}

// ── 0G: Public ────────────────────────────────────────────────────────────

export function getStats() {
  return req<GlobalStats>("/0g/stats");
}

export function getSavesRecent() {
  return req<{ saves: Array<{ wallet: string; saveIndex: number; coinSnapshot: number; fileSize: string; timestamp: string; pipeline: Pipeline }> }>(
    "/0g/saves/recent"
  );
}

export function getComputeStats() {
  return req<ComputeStats>("/0g/compute/stats");
}

export function getNetworkStatus() {
  return req<NetworkStatus>("/0g/network");
}

export function getLeaderboardVerified() {
  return req<{ leaderboard: LeaderboardEntry[] }>("/0g/leaderboard/verified");
}

export function getPlayerOverview(wallet: string) {
  return req<{ wallet: string; username?: string; trustScore: TrustScore; badge: Badge; stats: SaveSummary; latestSave: LatestSave | null }>(
    `/0g/player/overview/${wallet}`
  );
}

export function getProof(wallet: string, saveIndex: number) {
  return req<{ proof: ProofData }>(`/0g/proof/${wallet}/${saveIndex}`);
}

export function getExplorer(wallet: string) {
  return req<{ explorerUrl: string }>(`/0g/explorer/${wallet}`);
}
