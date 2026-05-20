import axios from 'axios';
import { API_BASE_URL } from '../config/api';
import * as zerog from '../api/zerog';
import { getHardcodedTournamentsResponse } from '../constants/tournaments';
import { getStableInjectedProvider } from '../lib/injectedEthereum';

const SESSION_CHANGED_EVENT = 'warzone-session-changed';

function notifySessionChanged() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(SESSION_CHANGED_EVENT));
  }
}

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

/** GET /player/leaderboard */
export const getLeaderboard = async (params: Record<string, unknown> = {}) => {
  try {
    const response = await api.get('/player/leaderboard', { params });
    return response.data?.leaderboard ?? response.data;
  } catch (error) {
    console.error('Error fetching leaderboard:', error);
    throw error;
  }
};

/** GET /0g/leaderboard/verified */
export const getAllTimeLeaderboard = async (params: Record<string, unknown> = {}) => {
  try {
    const filter = (params.filter as string) || 'finalized';
    const response = await api.get('/0g/leaderboard/verified', { params: { filter, ...params } });
    if (response.data && Array.isArray(response.data.leaderboard)) {
      return response.data.leaderboard;
    }
    return response.data;
  } catch (error) {
    console.error('Error fetching verified leaderboard:', error);
    throw error;
  }
};

export type LeaderboardEntry = {
  rank: number;
  name: string;
  coins: number;
  experience: number;
};

export function normalizeLeaderboardRows(data: unknown): LeaderboardEntry[] {
  if (!Array.isArray(data) || data.length === 0) return [];

  const first = data[0] as Record<string, unknown>;
  const hasRank = typeof first?.rank === 'number';

  if (hasRank) {
    return (data as Record<string, unknown>[]).map((row) => {
      const pr = row.PlayerResources as { coin?: number } | undefined;
      const pp = row.PlayerProfile as { exp?: number } | undefined;
      const name =
        row.displayName ??
        row.name ??
        (typeof row.walletAddress === 'string'
          ? `Warrior_${String(row.walletAddress).slice(2, 8)}`
          : 'Unknown');
      return {
        rank: Number(row.rank),
        name: String(name),
        coins: Number(row.coinSnapshot ?? pr?.coin ?? row.coins ?? 0),
        experience: Number(pp?.exp ?? row.experience ?? 0),
      };
    });
  }

  const mapped = (data as Record<string, unknown>[]).map((row, i) => {
    const pr = row.PlayerResources as { coin?: number } | undefined;
    const pp = row.PlayerProfile as { exp?: number } | undefined;
    const coins = Number(pr?.coin ?? row.coins ?? row.coinSnapshot ?? 0);
    return {
      name: String(
        row.displayName ??
          row.name ??
          (typeof row.walletAddress === 'string'
            ? `Warrior_${String(row.walletAddress).slice(2, 8)}`
            : `Player ${i + 1}`),
      ),
      coins,
      experience: Number(pp?.exp ?? row.experience ?? 0),
    };
  });
  mapped.sort((a, b) => b.coins - a.coins);
  return mapped.map((r, i) => ({ ...r, rank: i + 1 }));
}

/** PATCH /player/profile — display name stored on profile when supported */
export const checkNameAvailability = async (name: string) => {
  const token = localStorage.getItem('token');
  if (!token) throw new Error('No authentication token found');

  try {
    await api.patch('/player/profile', { displayName: name });
    return { success: true, message: 'Name is available' };
  } catch (error: any) {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/';
    }
    const message = error.response?.data?.message || error.message || 'Name is unavailable';
    return { success: false, message };
  }
};

export const savePlayerName = async (name: string) => {
  const token = localStorage.getItem('token');
  if (!token) throw new Error('No authentication token found');

  try {
    const response = await api.patch('/player/profile', { displayName: name });
    return { success: true, ...response.data };
  } catch (error: any) {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/';
    }
    throw error;
  }
};

export const getPlayerName = async (walletAddress: string) => {
  try {
    const overview = await zerog.getPlayerOverview(walletAddress);
    const displayName = (overview as { displayName?: string }).displayName;
    return { success: true, name: displayName ?? null };
  } catch (error) {
    console.error('Error getting player name:', error);
    throw error;
  }
};

type EthereumProvider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
};

/**
 * POST /auth/nonce + POST /auth/login (wallet signature).
 * Pass `ethereumProvider` when using Privy embedded wallet.
 */
export const loginUser = async (
  walletAddress: string,
  ethereumProvider?: EthereumProvider | null,
) => {
  try {
    localStorage.removeItem('token');

    const provider =
      ethereumProvider ??
      getStableInjectedProvider() ??
      (typeof window !== 'undefined' ? (window as Window & { ethereum?: EthereumProvider }).ethereum : null);

    if (!provider?.request) {
      throw new Error('No wallet provider available for signing');
    }

    const { message, nonce } = await zerog.getNonce(walletAddress);
    const signature = (await provider.request({
      method: 'personal_sign',
      params: [message, walletAddress],
    })) as string;

    const data = await zerog.login(walletAddress, signature, nonce);

    if (data?.token) {
      localStorage.setItem('walletAddress', walletAddress);
      localStorage.setItem('token', data.token);
      notifySessionChanged();
      return { success: true, token: data.token, wallet: data.wallet, expiresIn: data.expiresIn };
    }

    throw new Error('Login failed: no token received');
  } catch (error: any) {
    console.error('Login error:', error);
    localStorage.removeItem('token');
    localStorage.removeItem('walletAddress');
    notifySessionChanged();

    const errorMessage =
      error.response?.data?.message || error.message || 'Failed to connect to the server';
    throw new Error(errorMessage);
  }
};

/** IAP not exposed on 0G backend — kept for compatibility; may 404 until added server-side */
export const updateMarketplaceData = async ({
  type,
  value,
  orderId,
  txHash,
}: {
  type: string;
  value: string;
  orderId: string;
  txHash: string;
}) => {
  try {
    const response = await api.post('/iap/purchase', {
      category: type,
      product: value,
      orderId,
      txHash,
    });
    return response.data;
  } catch (error: any) {
    console.error('Marketplace update failed:', error?.response?.data || error);
    throw error;
  }
};

export const getMarketplacePurchaseStatus = async ({
  orderId,
  txHash,
}: {
  orderId: string;
  txHash: string;
}) => {
  try {
    const response = await api.get('/iap/purchase-status', { params: { orderId, txHash } });
    return response.data;
  } catch (error: any) {
    console.error('Marketplace purchase status failed:', error?.response?.data || error);
    throw error;
  }
};

/** GET /player/profile (auth) or GET /player/profile/:wallet (public) */
export const getPlayerProfile = async (walletAddress?: string | null) => {
  const token = typeof localStorage !== 'undefined' ? localStorage.getItem('token') : null;

  try {
    if (token) {
      const response = await api.get('/player/profile');
      return response.data;
    }
    if (!walletAddress) throw new Error('walletAddress is required without auth token');
    const response = await api.get(`/player/profile/${encodeURIComponent(walletAddress)}`);
    return response.data;
  } catch (error: any) {
    console.error('Failed to fetch player profile:', error?.response?.data || error);
    throw error;
  }
};

export const isAuthenticated = () => !!localStorage.getItem('walletAddress') && !!localStorage.getItem('token');

export const getWalletAddress = () => localStorage.getItem('walletAddress');

export const logout = () => {
  localStorage.removeItem('token');
  localStorage.removeItem('walletAddress');
  localStorage.removeItem('walletConnected');
  localStorage.removeItem('Intraverse');
  localStorage.removeItem('intraverseUserId');
  localStorage.removeItem('intraverseUserInfo');
  localStorage.removeItem('intraversePendingAuthHash');
  localStorage.removeItem('intraverseClientKey');
  localStorage.removeItem('intraverseMagicLoginUrl');
  notifySessionChanged();
  window.location.href = '/';
};

/** Hardcoded tournaments — no API */
export const getTournaments = async () => Promise.resolve(getHardcodedTournamentsResponse());

/** Round participation not on 0G backend */
export const getRoundParticipation = async (_roundId: string, _walletAddress: string) =>
  Promise.resolve({ body: { participation: null } });

export const checkNFTOwnership = async (_walletAddress: string) => false;

export default api;
