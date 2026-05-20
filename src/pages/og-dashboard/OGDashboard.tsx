import { useCallback, useEffect, useRef, useState, useMemo, type ReactNode, type ElementType } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWallets } from '@privy-io/react-auth';
import { useWallet } from '@/contexts/WalletContext';
import { GameButton } from '@/components/ui/game-button';
import {
  ArrowLeft, LogOut, RefreshCw, Shield, Activity, Wifi, Database,
  ChevronRight, Trophy, Search, Globe, Zap, Award, Users,
  CheckCircle, XCircle, Clock, ExternalLink, Lock, BarChart2,
} from 'lucide-react';
import * as api from '@/api/zerog';
import { ZG_JWT_KEY } from '@/api/zerog';
import zgLogo from '@/assets/0G-white-logo.png';

// ── Types ─────────────────────────────────────────────────────────────────

type Tab      = 'overview' | 'activity' | 'leaderboard' | 'explorer';
type LogLevel = 'info' | 'success' | 'error' | 'warn';
interface LogEntry { time: string; level: LogLevel; msg: string; }

// ── Constants ─────────────────────────────────────────────────────────────

const STAGE_ORDER  = ['stored', 'anchored', 'finalized', 'validated'] as const;
const STAGE_LABELS: Record<string, string> = {
  stored: '0G Storage', anchored: 'Chain Anchor', finalized: 'DA Finality', validated: 'TEE Compute',
};
const TRUST_NEXT: Record<string, number> = { bronze: 31, silver: 56, gold: 81, platinum: 100 };
const TRUST_START: Record<string, number> = { bronze: 0, silver: 31, gold: 56, platinum: 81 };

const BADGE_STYLE: Record<string, string> = {
  bronze:   'bg-amber-900/40 text-amber-400 border-amber-600/40',
  silver:   'bg-slate-700/40 text-slate-300 border-slate-400/40',
  gold:     'bg-yellow-900/40 text-yellow-300 border-yellow-500/40',
  platinum: 'bg-cyan-900/40  text-cyan-300  border-cyan-400/40',
};

const BADGE_GLOW: Record<string, string> = {
  bronze:   'shadow-[0_0_24px_hsl(38_80%_40%_/_0.35)]',
  silver:   'shadow-[0_0_24px_hsl(215_15%_65%_/_0.35)]',
  gold:     'shadow-[0_0_32px_hsl(42_100%_50%_/_0.45)]',
  platinum: 'shadow-[0_0_32px_hsl(185_90%_60%_/_0.45)]',
};

const STATUS_BADGE: Record<string, string> = {
  stored:    'bg-blue-950/60 text-blue-300 border-blue-500/30',
  anchored:  'bg-yellow-950/60 text-yellow-300 border-yellow-500/30',
  finalized: 'bg-green-950/60 text-green-300 border-green-500/30',
  validated: 'bg-cyan-950/60 text-cyan-300 border-cyan-500/30',
  rejected:  'bg-red-950/60 text-red-300 border-red-500/30',
};

const LOG_COLOR: Record<LogLevel, string> = {
  info: 'text-blue-400', success: 'text-green-400', error: 'text-red-400', warn: 'text-yellow-400',
};
const TOAST_STYLE: Record<LogLevel, string> = {
  success: 'bg-green-950/90 text-green-300 border-green-500/30',
  error:   'bg-red-950/90   text-red-300   border-red-500/30',
  warn:    'bg-yellow-950/90 text-yellow-300 border-yellow-500/30',
  info:    'bg-blue-950/90  text-blue-300  border-blue-500/30',
};

// ── Helpers ───────────────────────────────────────────────────────────────

function ts() { return new Date().toLocaleTimeString('en-US', { hour12: false }); }
function short(s: string, n = 8) {
  if (!s) return '—';
  return s.length > n * 2 + 3 ? `${s.slice(0, n)}...${s.slice(-6)}` : s;
}
function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

// ── Sub-components ────────────────────────────────────────────────────────

function SectionCard({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl border border-border bg-card/40 backdrop-blur-sm p-5 ${className}`}>
      {children}
    </div>
  );
}

function Label({ children }: { children: ReactNode }) {
  return (
    <div className="font-russo text-[10px] tracking-[0.25em] text-gold mb-3">{children}</div>
  );
}

function StatCard({ value, label, icon: Icon, highlight = false }:
  { value: string | number; label: string; icon?: ElementType; highlight?: boolean }) {
  return (
    <div className={`rounded-xl border px-4 py-3 ${highlight ? 'border-gold/40 bg-gold/5' : 'border-border/60 bg-background/30'}`}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className={`font-orbitron text-xl font-black ${highlight ? 'text-gold' : 'text-foreground'}`}>{String(value)}</div>
          <div className="font-russo text-[9px] tracking-widest text-muted-foreground mt-0.5">{label}</div>
        </div>
        {Icon && <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${highlight ? 'text-gold' : 'text-muted-foreground'}`} />}
      </div>
    </div>
  );
}

function PipelineBar({ pipeline }: { pipeline: Record<string, { done: boolean }> }) {
  return (
    <div className="flex items-start gap-0">
      {STAGE_ORDER.map((stage, i) => {
        const done = pipeline[stage]?.done ?? false;
        const isLast = i === STAGE_ORDER.length - 1;
        return (
          <div key={stage} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center gap-1.5 w-full">
              <div className={`w-7 h-7 rounded-full border-2 flex items-center justify-center transition-all ${
                done ? 'border-gold bg-gold/20' : 'border-border bg-card/40'
              }`}>
                {done
                  ? <CheckCircle className="w-3.5 h-3.5 text-gold" />
                  : <Clock className="w-3.5 h-3.5 text-muted-foreground/50" />
                }
              </div>
              <span className={`font-russo text-[8px] tracking-wide text-center leading-tight max-w-[58px] ${done ? 'text-gold' : 'text-muted-foreground/50'}`}>
                {STAGE_LABELS[stage]}
              </span>
            </div>
            {!isLast && (
              <div className={`flex-1 h-0.5 mx-1 mb-5 ${done ? 'bg-gold/50' : 'bg-border/40'}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

function TrustBadge({ label, size = 'sm' }: { label: string; size?: 'sm' | 'lg' }) {
  const style = BADGE_STYLE[label] || 'bg-card text-muted-foreground border-border';
  return (
    <span className={`font-russo tracking-widest border rounded-md ${style} ${
      size === 'lg' ? 'text-sm px-3 py-1.5' : 'text-[10px] px-2.5 py-1'
    }`}>
      {label.toUpperCase()}
    </span>
  );
}

function EventRow({ ev }: { ev: api.ActivityEvent }) {
  return (
    <div className="rounded-lg border border-border/50 bg-background/30 p-3">
      <div className="flex items-center justify-between mb-1.5 gap-2 flex-wrap">
        <span className={`font-russo text-[9px] tracking-wider px-2 py-0.5 rounded-full border ${STATUS_BADGE[ev.status] || 'bg-card text-muted-foreground border-border'}`}>
          {ev.type}
        </span>
        <span className="font-rajdhani text-[10px] text-muted-foreground">{timeAgo(ev.timestamp)}</span>
      </div>
      <div className="font-rajdhani text-xs text-foreground/80">{ev.title}</div>
      {ev.explorerUrl && (
        <a href={ev.explorerUrl} target="_blank" rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-[10px] text-gold hover:underline mt-1">
          View on explorer <ExternalLink className="w-2.5 h-2.5" />
        </a>
      )}
    </div>
  );
}

// ── Proof Modal ───────────────────────────────────────────────────────────

function ProofModal({ proof, onClose }: { proof: api.ProofData; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-md px-4"
      onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl border border-gold/30 bg-card/90 backdrop-blur-xl p-6 shadow-2xl"
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-full border border-gold/40 bg-gold/10 flex items-center justify-center">
            <Lock className="w-5 h-5 text-gold" />
          </div>
          <div>
            <div className="font-orbitron font-bold text-sm text-gold">PROOF CERTIFICATE</div>
            <div className="font-russo text-[9px] tracking-widest text-muted-foreground">Save #{proof.saveIndex}</div>
          </div>
          <div className={`ml-auto font-russo text-[9px] px-2 py-1 rounded-full border ${proof.valid ? 'bg-green-950/60 text-green-300 border-green-500/30' : 'bg-red-950/60 text-red-300 border-red-500/30'}`}>
            {proof.valid ? '✓ VALID' : '✗ INVALID'}
          </div>
        </div>
        <div className="space-y-2">
          {[
            { l: 'Wallet',       v: short(proof.wallet, 12),         mono: true },
            { l: 'Save Index',   v: `#${proof.saveIndex}`,            mono: true },
            { l: 'Root Hash',    v: short(proof.rootHash, 12),        mono: true },
            { l: 'On-Chain TX',  v: proof.onChainTxHash ? short(proof.onChainTxHash, 12) : '—', mono: true },
            { l: 'DA Hash',      v: proof.daRootHash    ? short(proof.daRootHash, 12)    : '—', mono: true },
            { l: 'Timestamp',    v: new Date(proof.timestamp).toLocaleString(), mono: false },
          ].map(r => (
            <div key={r.l} className="flex items-center justify-between py-1.5 border-b border-border/40 last:border-0 gap-4">
              <span className="font-russo text-[10px] tracking-wide text-muted-foreground shrink-0">{r.l}</span>
              <span className={`text-xs break-all text-right ${r.mono ? 'font-mono text-foreground/80' : 'font-rajdhani text-foreground/80'}`}>{r.v}</span>
            </div>
          ))}
        </div>
        <GameButton variant="metal" size="sm" className="mt-5 w-full" onClick={onClose}>
          Close
        </GameButton>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────

export default function OGDashboard() {
  const navigate  = useNavigate();
  const { address, isConnected, disconnect } = useWallet();
  const { wallets } = useWallets();

  const activeWallet  = wallets[0];
  const walletAddress = useMemo(() => address || activeWallet?.address || '', [address, activeWallet?.address]);

  // Core state
  const [jwt, setJwt]                 = useState<string | null>(() => localStorage.getItem(ZG_JWT_KEY));
  const [authLoading, setAuthLoading] = useState(false);
  const [tab, setTab]                 = useState<Tab>('overview');
  const [notification, setNotification] = useState<{ msg: string; type: LogLevel } | null>(null);
  const [logs, setLogs]               = useState<LogEntry[]>([]);
  const logEndRef                     = useRef<HTMLDivElement>(null);

  // Overview data
  const [dashData,     setDashData]     = useState<Awaited<ReturnType<typeof api.getDashboard>> | null>(null);
  const [badgeData,    setBadgeData]    = useState<{ badge: api.Badge } | null>(null);
  const [networkData,  setNetworkData]  = useState<api.NetworkStatus | null>(null);
  const [globalStats,  setGlobalStats]  = useState<api.GlobalStats | null>(null);
  const [computeStats, setComputeStats] = useState<api.ComputeStats | null>(null);
  const [loadingDash,  setLoadingDash]  = useState(false);

  // Activity tab
  const [activityData,  setActivityData]  = useState<Awaited<ReturnType<typeof api.getActivity>> | null>(null);
  const [activityPage,  setActivityPage]  = useState(1);
  const [activityMore,  setActivityMore]  = useState(false);
  const [recentSaves,   setRecentSaves]   = useState<{ wallet: string; saveIndex: number; coinSnapshot: number; fileSize: string; timestamp: string; pipeline: api.Pipeline }[]>([]);
  const [activityView,  setActivityView]  = useState<'mine' | 'global'>('mine');
  const [loadingActivity, setLoadingActivity] = useState(false);

  // Leaderboard tab
  const [leaderboard, setLeaderboard] = useState<api.LeaderboardEntry[]>([]);
  const [loadingLb,   setLoadingLb]   = useState(false);

  // Explorer tab
  const [history,      setHistory]      = useState<api.SaveRecord[]>([]);
  const [loadingHist,  setLoadingHist]  = useState(false);
  const [proofData,    setProofData]    = useState<api.ProofData | null>(null);
  const [loadingProof, setLoadingProof] = useState<number | null>(null);
  const [explorerUrl,  setExplorerUrl]  = useState<string | null>(null);

  // Integrity check (kept from original)
  const [integrityData,    setIntegrityData]    = useState<{ saveIndex: number; layers: Record<string, boolean>; allPassed: boolean } | null>(null);
  const [integrityLoading, setIntegrityLoading] = useState(false);

  // ── Effects ───────────────────────────────────────────────────────────

  useEffect(() => { if (!isConnected) navigate('/'); }, [isConnected, navigate]);
  useEffect(() => { logEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [logs]);
  useEffect(() => {
    if (!notification) return;
    const id = setTimeout(() => setNotification(null), 4000);
    return () => clearTimeout(id);
  }, [notification]);

  useEffect(() => {
    if (!jwt && walletAddress && activeWallet) authenticate();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [walletAddress, activeWallet]);

  useEffect(() => {
    if (jwt) fetchOverviewData(jwt);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jwt]);

  // Load tab-specific data on first visit
  useEffect(() => {
    if (tab === 'activity' && !activityData && jwt) fetchActivity(jwt, 1);
    if (tab === 'activity' && recentSaves.length === 0) fetchRecentSaves();
    if (tab === 'leaderboard' && leaderboard.length === 0) fetchLeaderboard();
    if (tab === 'explorer' && history.length === 0 && jwt) fetchHistory(jwt);
    if (tab === 'explorer' && !explorerUrl && walletAddress) fetchExplorer(walletAddress);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, jwt, walletAddress]);

  // ── Logger ────────────────────────────────────────────────────────────

  function log(level: LogLevel, msg: string) {
    setLogs(prev => [...prev, { time: ts(), level, msg }]);
    if (level === 'error')   setNotification({ msg, type: 'error' });
    if (level === 'success') setNotification({ msg, type: 'success' });
  }

  // ── Auth ──────────────────────────────────────────────────────────────

  const authenticate = useCallback(async () => {
    if (!walletAddress || !activeWallet) { log('error', 'No wallet connected.'); return; }
    try {
      setAuthLoading(true);
      log('info', `Requesting nonce for ${short(walletAddress)}`);
      const { message, nonce } = await api.getNonce(walletAddress);
      log('success', 'Nonce received — check your wallet for signature request...');

      const provider =
        typeof (activeWallet as any).getEthereumProvider === 'function'
          ? await (activeWallet as any).getEthereumProvider()
          : (window as any).ethereum;
      if (!provider?.request) throw new Error('No wallet provider available.');

      const signature = await provider.request({ method: 'personal_sign', params: [message, walletAddress] });
      const { token } = await api.login(walletAddress, signature, nonce);
      localStorage.setItem(ZG_JWT_KEY, token);
      setJwt(token);
      log('success', 'Session established. Valid for 7 days.');
      setNotification({ msg: 'Authenticated with 0G network.', type: 'success' });
    } catch (err: any) {
      log('error', `Auth failed: ${err.message}`);
    } finally {
      setAuthLoading(false);
    }
  }, [walletAddress, activeWallet]);

  // ── Data Fetchers ─────────────────────────────────────────────────────

  const fetchOverviewData = useCallback(async (token: string) => {
    setLoadingDash(true);
    log('info', 'Loading 0G network data...');
    try {
      const [dash, badge, net, gStats, cStats] = await Promise.allSettled([
        api.getDashboard(token),
        api.getBadge(token),
        api.getNetworkStatus(),
        api.getStats(),
        api.getComputeStats(),
      ]);
      if (dash.status     === 'fulfilled') setDashData(dash.value);
      if (badge.status    === 'fulfilled') setBadgeData(badge.value);
      if (net.status      === 'fulfilled') setNetworkData(net.value);
      if (gStats.status   === 'fulfilled') setGlobalStats(gStats.value);
      if (cStats.status   === 'fulfilled') setComputeStats(cStats.value);
      log('success', 'Dashboard data loaded.');
    } catch (err: any) {
      log('warn', `Partial data load: ${err.message}`);
    } finally {
      setLoadingDash(false);
    }
  }, []);

  const fetchActivity = useCallback(async (token: string, page: number) => {
    setLoadingActivity(true);
    try {
      const data = await api.getActivity(token, page);
      if (page === 1) {
        setActivityData(data);
      } else {
        setActivityData(prev => prev ? {
          ...data,
          events: [...(prev.events || []), ...data.events],
        } : data);
      }
      setActivityPage(page);
      setActivityMore(page < data.totalPages);
    } catch (err: any) {
      log('warn', `Activity fetch failed: ${err.message}`);
    } finally {
      setLoadingActivity(false);
    }
  }, []);

  const fetchRecentSaves = useCallback(async () => {
    try {
      const { saves } = await api.getSavesRecent();
      setRecentSaves(saves);
    } catch {}
  }, []);

  const fetchLeaderboard = useCallback(async () => {
    setLoadingLb(true);
    try {
      const { leaderboard: lb } = await api.getLeaderboardVerified();
      setLeaderboard(lb);
      log('info', `Loaded verified leaderboard — ${lb.length} entries.`);
    } catch (err: any) {
      log('warn', `Leaderboard unavailable: ${err.message}`);
    } finally {
      setLoadingLb(false);
    }
  }, []);

  const fetchHistory = useCallback(async (token: string) => {
    setLoadingHist(true);
    try {
      const { saves } = await api.getPlayerHistory(token);
      setHistory(saves);
    } catch (err: any) {
      log('warn', `History fetch failed: ${err.message}`);
    } finally {
      setLoadingHist(false);
    }
  }, []);

  const fetchExplorer = useCallback(async (wallet: string) => {
    try {
      const { explorerUrl: url } = await api.getExplorer(wallet);
      setExplorerUrl(url);
    } catch {}
  }, []);

  const fetchProof = useCallback(async (wallet: string, saveIndex: number) => {
    setLoadingProof(saveIndex);
    try {
      const { proof } = await api.getProof(wallet, saveIndex);
      setProofData(proof);
    } catch (err: any) {
      log('warn', `Proof unavailable: ${err.message}`);
    } finally {
      setLoadingProof(null);
    }
  }, []);

  const runIntegrityCheck = useCallback(async () => {
    if (!walletAddress) return;
    setIntegrityLoading(true);
    try {
      log('info', 'Running integrity check...');
      const d = await api.verify(walletAddress);
      setIntegrityData(d);
      log(d.allPassed ? 'success' : 'warn', d.allPassed ? 'All integrity layers passed.' : 'Some layers pending.');
    } catch (err: any) {
      log('error', `Integrity check failed: ${err.message}`);
    } finally {
      setIntegrityLoading(false);
    }
  }, [walletAddress]);

  const handleDisconnect = useCallback(async () => {
    localStorage.removeItem(ZG_JWT_KEY);
    ['walletConnected', 'walletAddress', 'token'].forEach(k => localStorage.removeItem(k));
    try { await disconnect(); } catch {}
    navigate('/');
  }, [disconnect, navigate]);

  // ── Derived ───────────────────────────────────────────────────────────

  const trustLabel  = dashData?.trustScore?.label?.toLowerCase() ?? '';
  const trustScore  = dashData?.trustScore?.score ?? 0;
  const trustNext   = TRUST_NEXT[trustLabel]  ?? 100;
  const trustStart  = TRUST_START[trustLabel] ?? 0;
  const trustPct    = trustNext > trustStart
    ? Math.min(100, ((trustScore - trustStart) / (trustNext - trustStart)) * 100)
    : 100;

  const myRank = leaderboard.find(e => e.wallet?.toLowerCase() === walletAddress?.toLowerCase());

  if (!isConnected) return null;

  // ══════════════════════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════════════════════

  return (
    <div className="min-h-screen bg-background text-foreground font-rajdhani">

      {/* Proof Modal */}
      {proofData && <ProofModal proof={proofData} onClose={() => setProofData(null)} />}

      {/* Toast */}
      {notification && (
        <div className={`fixed top-20 right-5 z-50 px-4 py-3 rounded-lg border text-sm font-semibold backdrop-blur-md animate-in slide-in-from-top-2 ${TOAST_STYLE[notification.type]}`}>
          {notification.msg}
        </div>
      )}

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 bg-background/90 backdrop-blur-xl border-b border-gold/15">
        <div className="container mx-auto px-4 flex items-center justify-between h-14 sm:h-16 gap-3">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/')}
              className="flex items-center gap-1.5 text-muted-foreground hover:text-gold transition-colors font-russo text-xs tracking-wider">
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">BACK</span>
            </button>
            <div className="w-px h-5 bg-border" />
            <div>
              <div className="font-orbitron font-black text-sm sm:text-base">
                <span className="text-gradient-gold">WARZONE</span>
                <span className="text-foreground ml-1">WARRIORS</span>
              </div>
              <div className="flex items-center gap-1.5 font-russo text-[9px] tracking-[0.2em] text-muted-foreground">
                <img src={zgLogo} alt="0G" className="h-7 w-auto opacity-80" />
                <span>NETWORK DASHBOARD</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {walletAddress && (
              <span className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-russo bg-card/60 border border-border/50">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                <span className="font-orbitron text-[10px] text-gold">{short(walletAddress, 6)}</span>
              </span>
            )}
            <span className={`px-2.5 py-1 rounded-full font-russo text-[10px] tracking-wider border ${
              authLoading ? 'bg-blue-900/40 text-blue-300 border-blue-500/30' :
              jwt         ? 'bg-green-900/40 text-green-300 border-green-500/30' :
                            'bg-yellow-900/40 text-yellow-300 border-yellow-500/30'
            }`}>
              {authLoading ? 'SIGNING...' : jwt ? 'AUTHENTICATED' : 'NO SESSION'}
            </span>
            <button onClick={handleDisconnect}
              className="p-2 rounded-lg border border-border bg-card/50 hover:border-gold/40 text-muted-foreground hover:text-gold transition-colors"
              title="Logout">
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
        <div className="h-[2px]" style={{ background: 'linear-gradient(90deg,transparent,hsl(42,100%,50%) 30%,hsl(42,100%,50%) 70%,transparent)' }} />
      </header>

      {/* ── Auth Banner ──────────────────────────────────────────────────── */}
      {!jwt && (
        <div className="container mx-auto px-4 pt-5">
          <div className="rounded-xl border border-gold/25 bg-card/40 backdrop-blur-sm p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <Shield className="w-8 h-8 text-gold shrink-0" />
            <div className="flex-1">
              <div className="font-orbitron font-bold text-sm text-gold mb-1">
                {authLoading ? 'Waiting for wallet signature...' : '0G Network Authentication Required'}
              </div>
              <p className="font-rajdhani text-sm text-muted-foreground">
                {authLoading
                  ? 'Approve the signature request in your wallet to continue.'
                  : 'Sign a message with your wallet to get a 7-day session token for full dashboard access.'}
              </p>
            </div>
            {!authLoading && (
              <GameButton variant="gold" size="sm" onClick={authenticate} disabled={!walletAddress} className="shrink-0">
                Authenticate
              </GameButton>
            )}
          </div>
        </div>
      )}

      {/* ── Tabs ─────────────────────────────────────────────────────────── */}
      <div className="container mx-auto px-4 pt-5">
        <div className="flex gap-1 bg-card/30 border border-border/50 rounded-xl p-1 overflow-x-auto">
          {([
            { id: 'overview',     icon: BarChart2, label: 'OVERVIEW'    },
            { id: 'activity',     icon: Activity,  label: 'ACTIVITY'    },
            { id: 'leaderboard',  icon: Trophy,    label: 'LEADERBOARD' },
            { id: 'explorer',     icon: Search,    label: 'EXPLORER'    },
          ] as const).map(t => (
            <button key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg font-russo text-[10px] tracking-[0.15em] whitespace-nowrap transition-all flex-1 justify-center ${
                tab === t.id
                  ? 'bg-gold/15 text-gold border border-gold/30'
                  : 'text-muted-foreground hover:text-foreground hover:bg-card/50'
              }`}>
              <t.icon className="w-3.5 h-3.5" />
              <span className="hidden xs:inline sm:inline">{t.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════
          OVERVIEW TAB
      ══════════════════════════════════════════════════════════════════ */}
      {tab === 'overview' && (
        <div className="container mx-auto px-4 py-5 space-y-4">

          {/* Trust Score Hero */}
          {dashData ? (
            <div className={`rounded-2xl border border-gold/25 bg-card/40 backdrop-blur-sm p-6 sm:p-8 ${BADGE_GLOW[trustLabel] || ''}`}>
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
                {/* Score */}
                <div className="flex items-center gap-5">
                  <div className="relative">
                    <div className="font-orbitron font-black text-[72px] sm:text-[88px] leading-none text-gold"
                      style={{ textShadow: '0 0 40px hsl(42 100% 50% / 0.5)' }}>
                      {trustScore}
                    </div>
                    <div className="font-russo text-[9px] tracking-[0.3em] text-muted-foreground text-center mt-1">TRUST SCORE</div>
                  </div>
                  {/* Badge */}
                  <div className="flex flex-col gap-2">
                    <TrustBadge label={trustLabel} size="lg" />
                    <div className="font-russo text-[9px] tracking-widest text-muted-foreground">
                      {dashData.trustScore?.description}
                    </div>
                  </div>
                </div>
                {/* Progress to next tier */}
                <div className="flex-1 w-full">
                  <div className="flex justify-between font-russo text-[9px] tracking-widest text-muted-foreground mb-1.5">
                    <span>{trustLabel.toUpperCase()}</span>
                    <span>NEXT TIER {trustNext}</span>
                  </div>
                  <div className="h-2 bg-background/60 rounded-full border border-border/50 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{
                        width: `${trustPct}%`,
                        background: 'linear-gradient(90deg, hsl(42 100% 40%), hsl(42 100% 60%))',
                        boxShadow: '0 0 12px hsl(42 100% 50% / 0.4)',
                      }}
                    />
                  </div>
                  <div className="flex justify-between font-mono text-[10px] text-muted-foreground/60 mt-1">
                    <span>{trustScore}</span>
                    <span>{trustNext}</span>
                  </div>
                </div>
                {/* Refresh */}
                <GameButton variant="metal" size="sm" className="shrink-0 self-end sm:self-center"
                  onClick={() => jwt && fetchOverviewData(jwt)} disabled={!jwt || loadingDash}>
                  <RefreshCw className={`w-3.5 h-3.5 mr-2 ${loadingDash ? 'animate-spin' : ''}`} />
                  {loadingDash ? 'Loading...' : 'Refresh'}
                </GameButton>
              </div>

              {/* Save Pipeline */}
              {dashData.latestSave && (
                <div className="mt-6 pt-5 border-t border-border/40">
                  <div className="font-russo text-[9px] tracking-[0.25em] text-muted-foreground mb-4">
                    LATEST SAVE PIPELINE — INDEX #{dashData.latestSave.saveIndex}
                  </div>
                  <PipelineBar pipeline={dashData.latestSave.pipeline as any} />
                </div>
              )}
            </div>
          ) : jwt && (
            <div className="rounded-2xl border border-gold/20 bg-card/40 p-8 text-center">
              <div className="flex items-center justify-center gap-3">
                <div className="w-2.5 h-2.5 rounded-full bg-gold animate-pulse" />
                <span className="font-russo text-xs tracking-widest text-gold">LOADING TRUST DATA</span>
              </div>
            </div>
          )}

          {/* Stats Row */}
          {dashData?.summary && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <StatCard value={dashData.summary.totalSaves}    label="TOTAL SAVES"   icon={Database}   highlight />
              <StatCard value={dashData.summary.finalizedSaves} label="DA FINALIZED"  icon={CheckCircle} />
              <StatCard value={dashData.summary.anchoredSaves}  label="ANCHORED"      icon={Lock}       />
              <StatCard value={dashData.summary.totalDataStored} label="DATA STORED"  icon={BarChart2}  />
            </div>
          )}

          {/* Latest Save Details */}
          {dashData?.latestSave && (
            <SectionCard>
              <Label>LATEST SAVE DETAILS</Label>
              <div className="grid sm:grid-cols-3 gap-2">
                {[
                  { l: 'Save Index', v: `#${dashData.latestSave.saveIndex}` },
                  { l: 'Root Hash',  v: short(dashData.latestSave.rootHash, 12) },
                  { l: 'Coin Snapshot', v: String(dashData.latestSave.coinSnapshot) },
                  { l: 'File Size',  v: String(dashData.latestSave.fileSize) },
                ].map(r => (
                  <div key={r.l} className="rounded-lg border border-border/50 bg-background/30 px-3 py-2.5">
                    <div className="font-russo text-[9px] tracking-widest text-muted-foreground mb-1">{r.l}</div>
                    <div className="font-mono text-xs text-foreground/80 truncate">{r.v}</div>
                  </div>
                ))}
              </div>
            </SectionCard>
          )}

          {/* Global Stats + Network Status side by side */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

            {/* Global Stats */}
            <SectionCard>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Globe className="w-4 h-4 text-gold" />
                  <Label>GLOBAL NETWORK STATS</Label>
                </div>
              </div>
              {globalStats ? (
                <div className="grid grid-cols-2 gap-2">
                  <StatCard value={globalStats.totalPlayers.toLocaleString()}  label="TOTAL PLAYERS"  icon={Users}     />
                  <StatCard value={globalStats.totalSaves.toLocaleString()}     label="TOTAL SAVES"    icon={Database}  />
                  <StatCard value={globalStats.finalizedSaves.toLocaleString()} label="DA FINALIZED"  icon={CheckCircle} />
                  <StatCard value={`${globalStats.averageTrustScore.toFixed(1)}`} label="AVG TRUST"   icon={Shield}    />
                </div>
              ) : (
                <div className="text-center py-6">
                  <div className="font-russo text-[10px] text-muted-foreground tracking-widest">LOADING GLOBAL DATA...</div>
                </div>
              )}
              {globalStats?.lastUpdated && (
                <div className="font-russo text-[9px] text-muted-foreground/50 mt-3 tracking-wider">
                  Updated {timeAgo(globalStats.lastUpdated)}
                </div>
              )}
            </SectionCard>

            {/* Network Status */}
            <SectionCard>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Wifi className="w-4 h-4 text-gold" />
                  <Label>NETWORK STATUS</Label>
                </div>
                <button
                  onClick={() => api.getNetworkStatus().then(setNetworkData).catch(() => {})}
                  className="p-1.5 rounded border border-border/50 text-muted-foreground hover:text-gold transition-colors">
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
              </div>
              {networkData ? (
                <>
                  <div className="flex items-center gap-2 mb-3 pb-3 border-b border-border/40">
                    <div className={`w-2 h-2 rounded-full ${networkData.overall === 'healthy' ? 'bg-green-400 animate-pulse' : networkData.overall === 'minor issues' ? 'bg-yellow-400 animate-pulse' : 'bg-red-400'}`} />
                    <span className={`font-russo text-[10px] tracking-widest ${
                      networkData.overall === 'healthy' ? 'text-green-400' :
                      networkData.overall === 'minor issues' ? 'text-yellow-400' : 'text-red-400'
                    }`}>{String(networkData.overall).toUpperCase()}</span>
                    {networkData.lastChecked && (
                      <span className="ml-auto font-russo text-[9px] text-muted-foreground/50">{timeAgo(networkData.lastChecked)}</span>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    {Object.entries(networkData.services || {}).map(([key, svc]) => (
                      <div key={key} className="flex items-center justify-between py-1.5 border-b border-border/40 last:border-0">
                        <span className="font-russo text-[10px] tracking-wide text-foreground/80">{svc.label || key}</span>
                        <div className="flex items-center gap-2">
                          <span className={`font-russo text-[9px] px-2 py-0.5 rounded-full border ${
                            svc.status === 'online'     ? 'bg-green-950/60 text-green-300 border-green-500/30'   :
                            svc.status === 'configured' ? 'bg-blue-950/60 text-blue-300 border-blue-500/30'     :
                            svc.status === 'connecting' ? 'bg-yellow-950/60 text-yellow-300 border-yellow-500/30' :
                                                          'bg-red-950/60 text-red-300 border-red-500/30'
                          }`}>{String(svc.status).toUpperCase()}</span>
                          {svc.latencyMs && (
                            <span className="font-mono text-[10px] text-muted-foreground">{svc.latencyMs}ms</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="text-center py-6">
                  <div className="font-russo text-[10px] text-muted-foreground tracking-widest">CHECKING SERVICES...</div>
                </div>
              )}
            </SectionCard>
          </div>

          {/* Anti-Cheat Compute Stats */}
          {computeStats && (
            <SectionCard>
              <div className="flex items-center gap-2 mb-4">
                <Zap className="w-4 h-4 text-gold" />
                <Label>AI ANTI-CHEAT COMPUTE</Label>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <StatCard value={computeStats.totalSessions.toLocaleString()}    label="TOTAL SESSIONS"    icon={Activity}  />
                <StatCard value={computeStats.analyzedSessions.toLocaleString()} label="ANALYZED"         icon={Shield}    />
                <StatCard value={computeStats.flaggedSessions.toLocaleString()}  label="FLAGGED"          icon={XCircle}   />
                <StatCard value={`${(computeStats.anomalyRate * 100).toFixed(2)}%`} label="ANOMALY RATE" icon={Zap} highlight={computeStats.anomalyRate > 0.05} />
              </div>
              {computeStats.lastProcessed && (
                <div className="font-russo text-[9px] text-muted-foreground/50 mt-3 tracking-wider">
                  Last processed {timeAgo(computeStats.lastProcessed)}
                </div>
              )}
            </SectionCard>
          )}

          {/* Integrity Check */}
          <SectionCard>
            <div className="flex items-center gap-2 mb-1">
              <Shield className="w-4 h-4 text-gold" />
              <Label>SAVE INTEGRITY CHECK</Label>
            </div>
            <p className="font-rajdhani text-sm text-muted-foreground mb-4">
              Verify your latest save across all layers: database, DA finalization, checksum, and TEE compute.
            </p>
            <GameButton variant="metal" size="sm" onClick={runIntegrityCheck} disabled={!walletAddress || integrityLoading}>
              {integrityLoading ? 'Checking...' : 'Run Integrity Check'}
            </GameButton>
            {integrityData && (
              <div className="mt-4 space-y-1">
                <div className="h-px bg-border mb-3" />
                <div className="flex justify-between py-1 text-xs border-b border-border/50">
                  <span className="text-muted-foreground">Save Index</span>
                  <span className="font-mono text-foreground">#{integrityData.saveIndex}</span>
                </div>
                {Object.entries(integrityData.layers).map(([key, passed]) => (
                  <div key={key} className="flex justify-between py-1 text-xs border-b border-border/50">
                    <span className="text-muted-foreground">{key.replace(/([A-Z])/g, ' $1').trim()}</span>
                    <span className={passed ? 'text-green-400 font-semibold' : 'text-red-400 font-semibold'}>
                      {passed ? '✓ Passed' : '✗ Failed'}
                    </span>
                  </div>
                ))}
                <div className="flex justify-between py-1.5 text-xs">
                  <span className="font-russo font-bold text-foreground">Overall</span>
                  <span className={integrityData.allPassed ? 'text-green-400 font-bold' : 'text-yellow-400 font-bold'}>
                    {integrityData.allPassed ? '✓ All layers passed' : '⚠ Some layers pending'}
                  </span>
                </div>
              </div>
            )}
          </SectionCard>

          {/* Activity Log */}
          <SectionCard>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-gold" />
                <Label>SESSION LOG</Label>
              </div>
              <button onClick={() => setLogs([])}
                className="font-russo text-[10px] tracking-wider text-muted-foreground hover:text-gold transition-colors border border-border/50 rounded px-2 py-1">
                CLEAR
              </button>
            </div>
            <div className="bg-background/60 border border-border/40 rounded-lg p-3 h-44 overflow-y-auto font-mono text-[11px] leading-relaxed">
              {logs.length === 0 && <div className="text-muted-foreground italic">No log entries yet.</div>}
              {logs.map((e, i) => (
                <div key={i} className="flex gap-2 flex-wrap">
                  <span className="text-muted-foreground shrink-0">[{e.time}]</span>
                  <span className={`shrink-0 min-w-[52px] ${LOG_COLOR[e.level]}`}>[{e.level.toUpperCase()}]</span>
                  <span className="text-foreground/80 break-all flex-1">{e.msg}</span>
                </div>
              ))}
              <div ref={logEndRef} />
            </div>
          </SectionCard>

        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          ACTIVITY TAB
      ══════════════════════════════════════════════════════════════════ */}
      {tab === 'activity' && (
        <div className="container mx-auto px-4 py-5 space-y-4">

          {/* Toggle */}
          <div className="flex gap-2">
            {(['mine', 'global'] as const).map(v => (
              <button key={v} onClick={() => setActivityView(v)}
                className={`px-4 py-1.5 rounded-lg font-russo text-[10px] tracking-widest border transition-all ${
                  activityView === v
                    ? 'bg-gold/15 text-gold border-gold/30'
                    : 'text-muted-foreground border-border/50 hover:border-gold/20'
                }`}>
                {v === 'mine' ? 'MY ACTIVITY' : 'GLOBAL FEED'}
              </button>
            ))}
            {activityView === 'mine' && (
              <button onClick={() => jwt && fetchActivity(jwt, 1)}
                className="ml-auto p-2 rounded-lg border border-border/50 text-muted-foreground hover:text-gold transition-colors">
                <RefreshCw className={`w-4 h-4 ${loadingActivity ? 'animate-spin' : ''}`} />
              </button>
            )}
          </div>

          {/* My Activity */}
          {activityView === 'mine' && (
            <div className="space-y-2">
              {!jwt && (
                <div className="rounded-xl border border-border bg-card/40 p-8 text-center">
                  <Shield className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                  <div className="font-russo text-xs text-muted-foreground tracking-widest">AUTHENTICATION REQUIRED</div>
                  <p className="font-rajdhani text-sm text-muted-foreground/60 mt-1">Sign in to view your activity.</p>
                  <GameButton variant="gold" size="sm" className="mt-3" onClick={authenticate} disabled={!walletAddress || authLoading}>
                    Authenticate
                  </GameButton>
                </div>
              )}
              {jwt && loadingActivity && activityData === null && (
                <div className="rounded-xl border border-border bg-card/40 p-8 text-center">
                  <div className="font-russo text-xs tracking-widest text-gold">LOADING ACTIVITY...</div>
                </div>
              )}
              {activityData?.events?.map(ev => <EventRow key={ev.id} ev={ev} />)}
              {activityData && activityData.events?.length === 0 && (
                <div className="rounded-xl border border-border bg-card/40 p-8 text-center">
                  <div className="font-russo text-xs text-muted-foreground tracking-widest">NO ACTIVITY YET</div>
                  <p className="font-rajdhani text-sm text-muted-foreground/60 mt-1">Play a game to generate your first save event.</p>
                </div>
              )}
              {activityMore && jwt && (
                <div className="text-center pt-2">
                  <GameButton variant="metal" size="sm" onClick={() => fetchActivity(jwt, activityPage + 1)} disabled={loadingActivity}>
                    {loadingActivity ? 'Loading...' : 'Load More'}
                  </GameButton>
                </div>
              )}
              {activityData && (
                <div className="font-russo text-[9px] tracking-widest text-muted-foreground/50 text-center pt-1">
                  {activityData.total} total events · Page {activityData.page} of {activityData.totalPages}
                </div>
              )}
            </div>
          )}

          {/* Global Feed */}
          {activityView === 'global' && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="font-russo text-[10px] tracking-[0.25em] text-gold">LIVE SAVE FEED</div>
                <button onClick={fetchRecentSaves}
                  className="p-2 rounded-lg border border-border/50 text-muted-foreground hover:text-gold transition-colors">
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>
              {recentSaves.length === 0 && (
                <div className="rounded-xl border border-border bg-card/40 p-8 text-center">
                  <div className="font-russo text-xs text-muted-foreground tracking-widest">LOADING GLOBAL FEED...</div>
                </div>
              )}
              {recentSaves.map((save, i) => (
                <div key={i} className="rounded-lg border border-border/50 bg-background/30 p-3">
                  <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                    <span className="font-mono text-[10px] text-gold">{short(save.wallet, 8)}</span>
                    <span className="font-rajdhani text-[10px] text-muted-foreground">{timeAgo(save.timestamp)}</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground mb-2">
                    <span>Save #{save.saveIndex}</span>
                    <span>·</span>
                    <span>{save.coinSnapshot} coins</span>
                    <span>·</span>
                    <span>{save.fileSize}</span>
                  </div>
                  <PipelineBar pipeline={save.pipeline as any} />
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          LEADERBOARD TAB
      ══════════════════════════════════════════════════════════════════ */}
      {tab === 'leaderboard' && (
        <div className="container mx-auto px-4 py-5 space-y-4">

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Trophy className="w-5 h-5 text-gold" />
              <div className="font-orbitron font-bold text-base text-gold">VERIFIED LEADERBOARD</div>
            </div>
            <GameButton variant="metal" size="sm" onClick={fetchLeaderboard} disabled={loadingLb}>
              <RefreshCw className={`w-3.5 h-3.5 mr-2 ${loadingLb ? 'animate-spin' : ''}`} />
              Refresh
            </GameButton>
          </div>

          {/* Player's own rank highlight */}
          {myRank && (
            <div className="rounded-xl border border-gold/40 bg-gold/5 p-4 flex items-center gap-4 flex-wrap">
              <div className="font-orbitron font-black text-3xl text-gold">#{myRank.rank}</div>
              <div className="flex-1">
                <div className="font-russo text-[10px] tracking-widest text-muted-foreground mb-1">YOUR RANK</div>
                <div className="flex items-center gap-2 flex-wrap">
                  <TrustBadge label={myRank.trustBadge?.toLowerCase()} />
                  <span className="font-rajdhani text-sm text-foreground/80">Trust Score: {myRank.trustScore}</span>
                  <span className="font-rajdhani text-sm text-muted-foreground">{myRank.verifiedSaves} verified saves</span>
                </div>
              </div>
            </div>
          )}

          {loadingLb && (
            <div className="rounded-xl border border-border bg-card/40 p-8 text-center">
              <div className="font-russo text-xs tracking-widest text-gold">LOADING LEADERBOARD...</div>
            </div>
          )}

          {!loadingLb && leaderboard.length === 0 && (
            <div className="rounded-xl border border-border bg-card/40 p-8 text-center">
              <Trophy className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-40" />
              <div className="font-russo text-xs text-muted-foreground tracking-widest">NO DATA</div>
              <p className="font-rajdhani text-sm text-muted-foreground/60 mt-1">Verified leaderboard is being populated.</p>
            </div>
          )}

          {leaderboard.length > 0 && (
            <div className="rounded-xl border border-border bg-card/40 backdrop-blur-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border/60 bg-background/40">
                      <th className="px-4 py-3 text-left font-russo text-[9px] tracking-[0.2em] text-muted-foreground">RANK</th>
                      <th className="px-4 py-3 text-left font-russo text-[9px] tracking-[0.2em] text-muted-foreground">PLAYER</th>
                      <th className="px-4 py-3 text-left font-russo text-[9px] tracking-[0.2em] text-muted-foreground">BADGE</th>
                      <th className="px-4 py-3 text-right font-russo text-[9px] tracking-[0.2em] text-muted-foreground">TRUST</th>
                      <th className="px-4 py-3 text-right font-russo text-[9px] tracking-[0.2em] text-muted-foreground hidden sm:table-cell">SAVES</th>
                      <th className="px-4 py-3 text-right font-russo text-[9px] tracking-[0.2em] text-muted-foreground hidden md:table-cell">LAST SAVE</th>
                    </tr>
                  </thead>
                  <tbody>
                    {leaderboard.map((entry) => {
                      const isMe = entry.wallet?.toLowerCase() === walletAddress?.toLowerCase();
                      return (
                        <tr key={entry.rank}
                          className={`border-b border-border/30 last:border-0 transition-colors ${
                            isMe ? 'bg-gold/5' : 'hover:bg-card/60'
                          }`}>
                          <td className="px-4 py-3">
                            <span className={`font-orbitron font-bold text-sm ${
                              entry.rank === 1 ? 'text-yellow-400' :
                              entry.rank === 2 ? 'text-slate-300' :
                              entry.rank === 3 ? 'text-amber-600' :
                              isMe ? 'text-gold' : 'text-muted-foreground'
                            }`}>
                              #{entry.rank}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              {isMe && <span className="w-1.5 h-1.5 rounded-full bg-gold animate-pulse shrink-0" />}
                              <div>
                                {entry.username && (
                                  <div className="font-russo text-xs text-foreground/90">{entry.username}</div>
                                )}
                                <div className="font-mono text-[10px] text-muted-foreground">{short(entry.wallet, 7)}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <TrustBadge label={entry.trustBadge?.toLowerCase()} />
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span className="font-orbitron font-bold text-sm text-gold">{entry.trustScore}</span>
                          </td>
                          <td className="px-4 py-3 text-right hidden sm:table-cell">
                            <span className="font-rajdhani text-sm text-muted-foreground">{entry.verifiedSaves}</span>
                          </td>
                          <td className="px-4 py-3 text-right hidden md:table-cell">
                            <span className="font-rajdhani text-xs text-muted-foreground">{entry.lastSave ? timeAgo(entry.lastSave) : '—'}</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          EXPLORER TAB
      ══════════════════════════════════════════════════════════════════ */}
      {tab === 'explorer' && (
        <div className="container mx-auto px-4 py-5 space-y-4">

          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <Search className="w-5 h-5 text-gold" />
              <div className="font-orbitron font-bold text-base text-gold">WALLET EXPLORER</div>
            </div>
            <div className="flex items-center gap-2">
              {explorerUrl && (
                <a href={explorerUrl} target="_blank" rel="noopener noreferrer">
                  <GameButton variant="gold" size="sm">
                    <ExternalLink className="w-3.5 h-3.5 mr-2" />
                    View on 0G Explorer
                  </GameButton>
                </a>
              )}
              {jwt && (
                <GameButton variant="metal" size="sm" onClick={() => fetchHistory(jwt)} disabled={loadingHist}>
                  <RefreshCw className={`w-3.5 h-3.5 mr-2 ${loadingHist ? 'animate-spin' : ''}`} />
                  Refresh
                </GameButton>
              )}
            </div>
          </div>

          {/* Wallet info */}
          {walletAddress && (
            <SectionCard>
              <div className="font-russo text-[9px] tracking-widest text-muted-foreground mb-1">WALLET ADDRESS</div>
              <div className="font-mono text-sm text-foreground/80 break-all">{walletAddress}</div>
            </SectionCard>
          )}

          {!jwt && (
            <div className="rounded-xl border border-border bg-card/40 p-8 text-center">
              <Shield className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
              <div className="font-russo text-xs text-muted-foreground tracking-widest">AUTHENTICATION REQUIRED</div>
              <GameButton variant="gold" size="sm" className="mt-3" onClick={authenticate} disabled={!walletAddress || authLoading}>
                Authenticate
              </GameButton>
            </div>
          )}

          {/* Save History */}
          {jwt && (
            <>
              <div className="font-russo text-[10px] tracking-[0.25em] text-gold">SAVE HISTORY</div>

              {loadingHist && history.length === 0 && (
                <div className="rounded-xl border border-border bg-card/40 p-8 text-center">
                  <div className="font-russo text-xs tracking-widest text-gold">LOADING SAVE HISTORY...</div>
                </div>
              )}

              {!loadingHist && history.length === 0 && (
                <div className="rounded-xl border border-border bg-card/40 p-8 text-center">
                  <Database className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-40" />
                  <div className="font-russo text-xs text-muted-foreground tracking-widest">NO SAVES FOUND</div>
                  <p className="font-rajdhani text-sm text-muted-foreground/60 mt-1">Complete a game to create your first save.</p>
                </div>
              )}

              {/* Timeline */}
              <div className="relative space-y-3">
                {/* Vertical line */}
                {history.length > 1 && (
                  <div className="absolute left-[19px] top-7 bottom-7 w-px bg-border/40" />
                )}

                {history.map((save, i) => {
                  const allDone   = STAGE_ORDER.every(s => save.pipeline?.[s]?.done);
                  const anyFailed = false;
                  return (
                    <div key={save.saveIndex} className="relative flex items-start gap-4">
                      {/* Timeline dot */}
                      <div className={`relative z-10 w-10 h-10 shrink-0 rounded-full border-2 flex items-center justify-center ${
                        allDone ? 'border-gold bg-gold/15' : 'border-border bg-card/60'
                      }`}>
                        <span className={`font-orbitron font-black text-[10px] ${allDone ? 'text-gold' : 'text-muted-foreground'}`}>
                          {save.saveIndex}
                        </span>
                      </div>

                      {/* Card */}
                      <div className={`flex-1 rounded-xl border bg-card/40 backdrop-blur-sm p-4 ${
                        allDone ? 'border-gold/20' : 'border-border'
                      }`}>
                        <div className="flex items-start justify-between gap-2 mb-3 flex-wrap">
                          <div>
                            <div className="font-russo text-[10px] tracking-widest text-muted-foreground">SAVE #{save.saveIndex}</div>
                            <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                              <span className="font-rajdhani text-xs text-muted-foreground">{save.coinSnapshot} coins</span>
                              <span className="font-rajdhani text-xs text-muted-foreground">·</span>
                              <span className="font-rajdhani text-xs text-muted-foreground">{save.fileSize}</span>
                              <span className="font-rajdhani text-xs text-muted-foreground">·</span>
                              <span className="font-rajdhani text-xs text-muted-foreground">{timeAgo(save.timestamp)}</span>
                            </div>
                          </div>
                          <GameButton
                            variant="metal"
                            size="sm"
                            disabled={loadingProof === save.saveIndex}
                            onClick={() => fetchProof(walletAddress, save.saveIndex)}>
                            <Lock className="w-3 h-3 mr-1.5" />
                            {loadingProof === save.saveIndex ? 'Loading...' : 'Proof'}
                          </GameButton>
                        </div>

                        {save.rootHash && (
                          <div className="font-mono text-[10px] text-muted-foreground/60 mb-3 truncate">
                            {short(save.rootHash, 16)}
                          </div>
                        )}

                        <PipelineBar pipeline={save.pipeline as any} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}

    </div>
  );
}
