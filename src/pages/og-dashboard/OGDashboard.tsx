import { useCallback, useEffect, useRef, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWallets } from '@privy-io/react-auth';
import { useWallet } from '@/contexts/WalletContext';
import { GameButton } from '@/components/ui/game-button';
import { ArrowLeft, LogOut, RefreshCw, Shield, Activity, Wifi, Database, ChevronRight } from 'lucide-react';
import * as api from '@/api/zerog';

// ── Types ─────────────────────────────────────────────────────────────────────

type LogLevel = 'info' | 'success' | 'error' | 'warn';
interface LogEntry { time: string; level: LogLevel; msg: string; }

// ── Helpers ───────────────────────────────────────────────────────────────────

function ts() { return new Date().toLocaleTimeString('en-US', { hour12: false }); }
function short(s: string, n = 10) {
  if (!s) return '—';
  return s.length > n * 2 + 3 ? `${s.slice(0, n)}...${s.slice(-6)}` : s;
}
function formatBytes(n: number) {
  if (!n) return '0 B';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

const STAGE_LABELS: Record<string, string> = {
  stored: '0G Storage', anchored: 'Chain Anchor', finalized: 'DA Finality', validated: 'TEE Compute',
};

const OG_JWT_KEY = 'og_warrior_jwt';

// ── Log level styles ──────────────────────────────────────────────────────────

const LOG_LEVEL_COLOR: Record<LogLevel, string> = {
  info:    'text-blue-400',
  success: 'text-green-400',
  error:   'text-red-400',
  warn:    'text-yellow-400',
};

const TOAST_STYLE: Record<LogLevel, string> = {
  success: 'bg-green-950/90 text-green-300 border-green-500/30',
  error:   'bg-red-950/90   text-red-300   border-red-500/30',
  warn:    'bg-yellow-950/90 text-yellow-300 border-yellow-500/30',
  info:    'bg-blue-950/90  text-blue-300  border-blue-500/30',
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function OGDashboard() {
  const navigate = useNavigate();
  const { address, isConnected, disconnect } = useWallet();
  const { wallets } = useWallets();

  const activeWallet = wallets[0];
  const walletAddress = useMemo(() => address || activeWallet?.address || '', [address, activeWallet?.address]);

  const [jwt, setJwt]                   = useState<string | null>(() => localStorage.getItem(OG_JWT_KEY));
  const [authLoading, setAuthLoading]   = useState(false);
  const [logs, setLogs]                 = useState<LogEntry[]>([]);
  const [dashData, setDashData]         = useState<Record<string, any> | null>(null);
  const [networkData, setNetworkData]   = useState<Record<string, any> | null>(null);
  const [activityData, setActivityData] = useState<Record<string, any> | null>(null);
  const [loadResult, setLoadResult]     = useState<string | null>(null);
  const [loadingDash, setLoadingDash]   = useState(false);
  const [notification, setNotification] = useState<{ msg: string; type: LogLevel } | null>(null);
  const [integrityData, setIntegrityData]   = useState<{ saveIndex: number; layers: Record<string, boolean>; allPassed: boolean } | null>(null);
  const [integrityLoading, setIntegrityLoading] = useState(false);

  const logEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => { if (!isConnected) navigate('/'); }, [isConnected, navigate]);
  useEffect(() => { logEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [logs]);
  useEffect(() => {
    if (!notification) return;
    const id = setTimeout(() => setNotification(null), 4000);
    return () => clearTimeout(id);
  }, [notification]);

  function log(level: LogLevel, msg: string) {
    setLogs(prev => [...prev, { time: ts(), level, msg }]);
    if (level === 'error')   setNotification({ msg, type: 'error' });
    if (level === 'success') setNotification({ msg, type: 'success' });
  }

  // Auto-auth on mount when wallet is ready but no JWT
  useEffect(() => {
    if (!jwt && walletAddress && activeWallet) authenticate();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [walletAddress, activeWallet]);

  useEffect(() => { if (jwt) fetchDashboard(jwt); }, [jwt]); // eslint-disable-line react-hooks/exhaustive-deps

  const authenticate = useCallback(async () => {
    if (!walletAddress || !activeWallet) {
      log('error', 'No wallet connected.');
      return;
    }
    try {
      setAuthLoading(true);
      log('info', `Requesting nonce for ${short(walletAddress)}`);
      const { message, nonce } = await api.getNonce(walletAddress);
      log('success', 'Nonce received. Check your wallet for a signature request...');

      const provider =
        typeof (activeWallet as any).getEthereumProvider === 'function'
          ? await (activeWallet as any).getEthereumProvider()
          : (window as any).ethereum;

      if (!provider?.request) throw new Error('No wallet provider available.');

      const signature = await provider.request({ method: 'personal_sign', params: [message, walletAddress] });
      log('info', 'Signature obtained. Exchanging for session token...');
      const { token } = await api.login(walletAddress, signature, nonce);
      localStorage.setItem(OG_JWT_KEY, token);
      setJwt(token);
      log('success', 'Authentication complete. Session valid for 7 days.');
      setNotification({ msg: 'Authenticated with 0G network.', type: 'success' });
    } catch (err: any) {
      log('error', `Authentication failed: ${err.message}`);
    } finally {
      setAuthLoading(false);
    }
  }, [walletAddress, activeWallet]);

  const fetchDashboard = useCallback(async (token: string) => {
    setLoadingDash(true);
    log('info', 'Loading 0G network data...');
    try {
      const [dash, net, act] = await Promise.all([
        api.getDashboard(token),
        api.getNetworkStatus(),
        api.getActivity(token),
      ]);
      setDashData(dash as Record<string, any>);
      setNetworkData(net as Record<string, any>);
      setActivityData(act as Record<string, any>);
      log('success', 'Dashboard data loaded.');
    } catch (err: any) {
      log('warn', `Dashboard fetch failed: ${err.message}`);
    } finally {
      setLoadingDash(false);
    }
  }, []);

  const testLoad = useCallback(async () => {
    if (!jwt) return;
    try {
      log('info', 'Fetching latest save from 0G Storage...');
      const { buffer, rootHash, saveIndex, daStatus, checksum } = await api.loadBinary(jwt);
      const size = formatBytes(buffer.byteLength);
      setLoadResult(`${size} — Save #${saveIndex} — DA: ${daStatus} — Hash: ${short(rootHash, 12)}`);
      log('success', `Loaded Save #${saveIndex} | ${size} | DA: ${daStatus} | Checksum: ${short(checksum, 8)}`);
      setNotification({ msg: `Loaded Save #${saveIndex} from 0G Storage.`, type: 'success' });
    } catch (err: any) {
      log('error', `Load failed: ${err.message}`);
    }
  }, [jwt]);

  const runIntegrityCheck = useCallback(async () => {
    if (!walletAddress) return;
    setIntegrityLoading(true);
    try {
      log('info', 'Running integrity check across all verification layers...');
      const d = await api.verify(walletAddress);
      setIntegrityData(d);
      log(d.allPassed ? 'success' : 'warn', d.allPassed ? 'All integrity layers passed.' : 'Some layers failed.');
    } catch (err: any) {
      log('error', `Integrity check failed: ${err.message}`);
    } finally {
      setIntegrityLoading(false);
    }
  }, [walletAddress]);

  const handleDisconnect = useCallback(async () => {
    localStorage.removeItem(OG_JWT_KEY);
    ['walletConnected', 'walletAddress', 'token'].forEach(k => localStorage.removeItem(k));
    try { await disconnect(); } catch {}
    navigate('/');
  }, [disconnect, navigate]);

  const trustLabel = (dashData?.trustScore as any)?.label?.toLowerCase?.() ?? '';
  const TRUST_BADGE_STYLE: Record<string, string> = {
    bronze:   'bg-amber-900/40 text-amber-400 border border-amber-600/40',
    silver:   'bg-slate-700/40 text-slate-300 border border-slate-400/40',
    gold:     'bg-yellow-900/40 text-yellow-300 border border-yellow-400/40',
    platinum: 'bg-cyan-900/40 text-cyan-300 border border-cyan-400/40',
  };

  if (!isConnected) return null;

  return (
    <div className="min-h-screen bg-background text-foreground font-rajdhani">

      {/* Toast */}
      {notification && (
        <div className={`fixed top-20 right-5 z-50 px-4 py-3 rounded-lg border text-sm font-semibold backdrop-blur-md animate-in slide-in-from-top-2 ${TOAST_STYLE[notification.type]}`}>
          {notification.msg}
        </div>
      )}

      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/90 backdrop-blur-xl border-b border-gold/15">
        <div className="container mx-auto px-4 flex items-center justify-between h-14 sm:h-16 gap-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/')}
              className="flex items-center gap-1.5 text-muted-foreground hover:text-gold transition-colors font-russo text-xs tracking-wider"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">BACK</span>
            </button>
            <div className="w-px h-5 bg-border" />
            <div>
              <div className="font-orbitron font-black text-sm sm:text-base">
                <span className="text-gradient-gold">WARZONE</span>
                <span className="text-foreground ml-1">WARRIORS</span>
              </div>
              <div className="font-russo text-[9px] tracking-[0.2em] text-muted-foreground">0G NETWORK DASHBOARD</div>
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
            <button
              onClick={handleDisconnect}
              className="p-2 rounded-lg border border-border bg-card/50 hover:border-gold/40 text-muted-foreground hover:text-gold transition-colors"
              title="Logout"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
        <div className="h-[2px]" style={{ background: "linear-gradient(90deg, transparent, hsl(42,100%,50%) 30%, hsl(42,100%,50%) 70%, transparent)" }} />
      </header>

      {/* Auth Banner */}
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
                  ? 'A signature request has been sent to your wallet. Please approve it to continue.'
                  : 'Sign a message with your wallet to authenticate. This generates a 7-day session token.'}
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

      {/* Body */}
      <div className="container mx-auto px-4 py-5 grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-4">

        {/* LEFT */}
        <div className="space-y-4">

          {/* Session Status */}
          <div className="rounded-xl border border-border bg-card/40 backdrop-blur-sm p-5">
            <div className="font-russo text-[10px] tracking-[0.25em] text-gold mb-3">SESSION STATUS</div>
            <div className="space-y-2 mb-4">
              <div>
                <div className="font-russo text-[9px] tracking-widest text-muted-foreground mb-0.5">WALLET</div>
                <div className="font-mono text-xs text-foreground/80 break-all">{walletAddress || '—'}</div>
              </div>
              <div>
                <div className="font-russo text-[9px] tracking-widest text-muted-foreground mb-0.5">0G SESSION</div>
                <div className={`font-russo text-xs font-semibold ${jwt ? 'text-green-400' : 'text-yellow-400'}`}>
                  {jwt ? 'Active — expires in 7 days' : 'Not authenticated'}
                </div>
              </div>
            </div>
            {jwt && (
              <GameButton variant="metal" size="sm" onClick={authenticate} disabled={authLoading}>
                {authLoading ? 'Signing...' : 'Re-authenticate'}
              </GameButton>
            )}
          </div>

          {/* Load Latest Save */}
          <div className="rounded-xl border border-border bg-card/40 backdrop-blur-sm p-5">
            <div className="flex items-center gap-2 mb-1">
              <Database className="w-4 h-4 text-gold" />
              <div className="font-russo text-[10px] tracking-[0.25em] text-gold">LOAD LATEST SAVE</div>
            </div>
            <p className="font-rajdhani text-sm text-muted-foreground mb-4">
              Fetch and verify your latest game save from 0G decentralized storage.
            </p>
            <GameButton variant="gold" size="sm" onClick={testLoad} disabled={!jwt}>
              Fetch Latest Save
            </GameButton>
            {!jwt && <p className="text-xs text-muted-foreground mt-2">Authenticate first to enable.</p>}
            {loadResult && (
              <div className="mt-3 p-3 rounded-lg bg-green-950/40 border border-green-500/20 font-mono text-xs text-green-300 break-all">
                {loadResult}
              </div>
            )}
          </div>

          {/* Integrity Check */}
          <div className="rounded-xl border border-border bg-card/40 backdrop-blur-sm p-5">
            <div className="flex items-center gap-2 mb-1">
              <Shield className="w-4 h-4 text-gold" />
              <div className="font-russo text-[10px] tracking-[0.25em] text-gold">SAVE INTEGRITY CHECK</div>
            </div>
            <p className="font-rajdhani text-sm text-muted-foreground mb-4">
              Verify your save across all layers: database record, DA finalization, checksum, and TEE compute.
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
          </div>

          {/* Activity Log */}
          <div className="rounded-xl border border-border bg-card/40 backdrop-blur-sm p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-gold" />
                <div className="font-russo text-[10px] tracking-[0.25em] text-gold">ACTIVITY LOG</div>
              </div>
              <button
                onClick={() => setLogs([])}
                className="font-russo text-[10px] tracking-wider text-muted-foreground hover:text-gold transition-colors border border-border/50 rounded px-2 py-1"
              >
                CLEAR
              </button>
            </div>
            <div className="bg-background/60 border border-border/40 rounded-lg p-3 h-48 overflow-y-auto font-mono text-[11px] leading-relaxed">
              {logs.length === 0 && <div className="text-muted-foreground italic">No log entries yet.</div>}
              {logs.map((e, i) => (
                <div key={i} className="flex gap-2 flex-wrap">
                  <span className="text-muted-foreground shrink-0">[{e.time}]</span>
                  <span className={`shrink-0 min-w-[52px] ${LOG_LEVEL_COLOR[e.level]}`}>[{e.level.toUpperCase()}]</span>
                  <span className="text-foreground/80 break-all flex-1">{e.msg}</span>
                </div>
              ))}
              <div ref={logEndRef} />
            </div>
          </div>

        </div>

        {/* RIGHT */}
        <div className="space-y-4">

          {/* Network Status */}
          <div className="rounded-xl border border-border bg-card/40 backdrop-blur-sm p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Wifi className="w-4 h-4 text-gold" />
                <div className="font-russo text-[10px] tracking-[0.25em] text-gold">NETWORK STATUS</div>
              </div>
              <button
                onClick={() => api.getNetworkStatus().then(d => setNetworkData(d as Record<string, any>)).catch(() => {})}
                className="p-1.5 rounded border border-border/50 text-muted-foreground hover:text-gold transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>
            {networkData ? (
              <div>
                <div className="font-rajdhani text-xs text-muted-foreground mb-3">
                  Overall:{' '}
                  <span className={
                    networkData.overall === 'healthy'       ? 'text-green-400 font-semibold' :
                    networkData.overall === 'minor issues'  ? 'text-yellow-400 font-semibold' :
                                                              'text-red-400 font-semibold'
                  }>{String(networkData.overall)}</span>
                </div>
                <div className="space-y-1.5">
                  {Object.entries((networkData.services as Record<string, any>) || {}).map(([key, svc]) => (
                    <div key={key} className="flex items-center justify-between py-1.5 border-b border-border/40 last:border-0">
                      <span className="font-russo text-[10px] tracking-wide text-foreground/80">{svc.label || key}</span>
                      <div className="flex items-center gap-2">
                        <span className={`font-russo text-[9px] px-2 py-0.5 rounded-full border ${
                          svc.status === 'online'     ? 'bg-green-950/60 text-green-300 border-green-500/30' :
                          svc.status === 'configured' ? 'bg-blue-950/60 text-blue-300 border-blue-500/30'   :
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
              </div>
            ) : (
              <div className="py-6 text-center">
                <div className="font-russo text-xs text-muted-foreground mb-1">AWAITING AUTHENTICATION</div>
                <p className="font-rajdhani text-xs text-muted-foreground/60">Network status loads after wallet auth.</p>
              </div>
            )}
          </div>

          {/* Trust Score */}
          {dashData && (
            <div className="rounded-xl border border-border bg-card/40 backdrop-blur-sm p-5">
              <div className="font-russo text-[10px] tracking-[0.25em] text-gold mb-3">TRUST SCORE</div>
              <div className="flex items-baseline gap-3 mb-2">
                <span className="font-orbitron font-black text-5xl text-gold" style={{ textShadow: '0 0 20px hsl(42 100% 50% / 0.4)' }}>
                  {(dashData.trustScore as any)?.score ?? '—'}
                </span>
                {trustLabel && (
                  <span className={`font-russo text-[11px] tracking-widest px-2.5 py-1 rounded-md ${TRUST_BADGE_STYLE[trustLabel] || 'bg-card text-muted-foreground border border-border'}`}>
                    {String((dashData.trustScore as any)?.label || '').toUpperCase()}
                  </span>
                )}
              </div>
              <p className="font-rajdhani text-xs text-muted-foreground mb-4">
                {String((dashData.trustScore as any)?.description || '')}
              </p>

              <div className="grid grid-cols-2 gap-2 mb-4">
                {[
                  { v: (dashData.summary as any)?.totalSaves ?? 0,      l: 'Total Saves'  },
                  { v: (dashData.summary as any)?.finalizedSaves ?? 0,  l: 'DA Finalized' },
                  { v: (dashData.summary as any)?.anchoredSaves ?? 0,   l: 'Anchored'     },
                  { v: (dashData.summary as any)?.totalDataStored ?? '0 B', l: 'Data Stored' },
                ].map(s => (
                  <div key={s.l} className="rounded-lg border border-border/60 bg-background/30 px-3 py-2.5">
                    <div className="font-orbitron text-base font-bold text-gold">{String(s.v)}</div>
                    <div className="font-russo text-[9px] tracking-widest text-muted-foreground mt-0.5">{s.l}</div>
                  </div>
                ))}
              </div>

              {(dashData.latestSave as any) && (
                <div>
                  <div className="h-px bg-border mb-3" />
                  <div className="font-russo text-[9px] tracking-widest text-muted-foreground mb-2">
                    LATEST SAVE — INDEX #{(dashData.latestSave as any).saveIndex}
                  </div>
                  {[
                    { l: 'Root Hash', v: short((dashData.latestSave as any).rootHash, 12) },
                    { l: 'Coins',     v: String((dashData.latestSave as any).coinSnapshot) },
                    { l: 'Size',      v: String((dashData.latestSave as any).fileSize) },
                  ].map(r => (
                    <div key={r.l} className="flex justify-between py-1 text-xs border-b border-border/40 last:border-0">
                      <span className="text-muted-foreground">{r.l}</span>
                      <span className="font-mono text-foreground/80">{r.v}</span>
                    </div>
                  ))}
                  <div className="flex flex-wrap gap-1.5 mt-3">
                    {Object.entries((dashData.latestSave as any).pipeline || {}).map(([k, v]: [string, any]) => (
                      <div key={k} className={`flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-russo ${
                        v.done
                          ? 'bg-green-950/50 text-green-300 border-green-500/30'
                          : 'bg-card text-muted-foreground border-border/40'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${v.done ? 'bg-green-400' : 'bg-muted-foreground'}`} />
                        {STAGE_LABELS[k] || k}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <GameButton
                variant="metal"
                size="sm"
                className="mt-4 w-full"
                onClick={() => jwt && fetchDashboard(jwt)}
                disabled={!jwt || loadingDash}
              >
                <RefreshCw className="w-3.5 h-3.5 mr-2" />
                {loadingDash ? 'Refreshing...' : 'Refresh Stats'}
              </GameButton>
            </div>
          )}

          {/* Activity Feed */}
          {(activityData as any)?.events?.length > 0 && (
            <div className="rounded-xl border border-border bg-card/40 backdrop-blur-sm p-5">
              <div className="font-russo text-[10px] tracking-[0.25em] text-gold mb-3">ACTIVITY FEED</div>
              <div className="space-y-2">
                {((activityData as any).events as any[]).slice(0, 10).map((ev: any) => (
                  <div key={ev.id} className="rounded-lg border border-border/50 bg-background/30 p-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className={`font-russo text-[9px] tracking-wider px-2 py-0.5 rounded-full border ${
                        ev.status === 'stored'    ? 'bg-blue-950/60 text-blue-300 border-blue-500/30'    :
                        ev.status === 'anchored'  ? 'bg-yellow-950/60 text-yellow-300 border-yellow-500/30' :
                        ev.status === 'finalized' ? 'bg-green-950/60 text-green-300 border-green-500/30' :
                        ev.status === 'rejected'  ? 'bg-red-950/60 text-red-300 border-red-500/30'       :
                                                    'bg-card text-muted-foreground border-border'
                      }`}>{String(ev.type)}</span>
                      <span className="font-rajdhani text-[10px] text-muted-foreground">
                        {new Date(ev.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                    <div className="font-rajdhani text-xs text-foreground/80">{ev.title}</div>
                    {ev.explorerUrl && (
                      <a
                        href={ev.explorerUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[10px] text-gold hover:underline mt-1"
                      >
                        View on explorer <ChevronRight className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Empty right column loading state */}
          {!dashData && !networkData && jwt && (
            <div className="rounded-xl border border-border bg-card/40 p-8 text-center">
              <div className="inline-flex items-center gap-3">
                <div className="w-2.5 h-2.5 rounded-full bg-gold animate-pulse" />
                <span className="font-russo text-xs tracking-widest text-gold">LOADING 0G DATA</span>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
