import { useEffect, useState, useCallback } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Home, Trophy, Star, X, CalendarRange, Layers } from 'lucide-react';
import { getTournaments, getRoundParticipation } from '../../utils/api';
import { useWallet } from '../../contexts/WalletContext';
import MobileBottomNav from '../../components/MobileBottomNav';
import PageWalletControls from '../../components/PageWalletControls';
import decoLamp from '@/assets/images/deco-lamp.png';
import decoChain from '@/assets/images/deco-chain.png';
import decoRubble from '@/assets/images/deco-rubble.png';
import './InterversePlayPage.css';

const DEBUG_LOGIN_TRACE = String(import.meta.env.VITE_DEBUG_LOGIN_TRACE || '').toLowerCase() === 'true';
const trace = (...args: unknown[]) => {
  if (DEBUG_LOGIN_TRACE) console.log('[intraverse-page-trace]', ...args);
};

const TOURNAMENT_MARQUEE_ITEMS = [
  'BRACKETS',
  'LIVE OPS',
  'LIVE WINDOWS',
  'ACTIVE ROUNDS',
  'COMPETE',
  'WARZONE CIRCUIT',
  'CLAIM GLORY',
  'TOURNAMENT SEASON',
];

/* ─── Helpers ────────────────────────────────────────────────────────────── */
function fmtDate(ms) {
  if (!ms) return '—';
  return new Date(ms).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

function fmtDateTime(ms) {
  if (!ms) return 'TBA';
  return new Date(ms).toLocaleString(undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function isRoundActive(round) {
  if (!Array.isArray(round?.intervals) || round.intervals.length === 0) return false;
  const now = Date.now();
  return round.intervals.some(iv => now >= iv.startDate && now <= iv.endDate);
}

function deriveTournamentState(tournament) {
  const now = Date.now();
  const startMs = Number(tournament?.startDate || 0);
  const endMs = Number(tournament?.endDate || 0);
  const normalizedStatus = String(tournament?.status || '').toUpperCase();
  const isLiveStatus = ['RUNNING', 'ACTIVE', 'LIVE', 'IN_PROGRESS'].includes(normalizedStatus);
  const isEndedStatus = ['COMPLETED', 'ENDED', 'FINISHED', 'DONE', 'CLOSED'].includes(normalizedStatus);
  const isUpcomingStatus = ['UPCOMING', 'SCHEDULED', 'PENDING'].includes(normalizedStatus);
  const isPast =
    isEndedStatus || (Number.isFinite(endMs) && endMs > 0 && endMs < now);
  const isActive =
    !isPast &&
    (isLiveStatus ||
      (Number.isFinite(startMs) && startMs > 0 &&
        Number.isFinite(endMs) && endMs > 0 &&
        startMs <= now && now <= endMs));
  const isUpcoming =
    !isPast && !isActive && (isUpcomingStatus || (Number.isFinite(startMs) && startMs > now));
  const displayStatus = isPast ? 'ENDED' : isActive ? 'ACTIVE' : 'UPCOMING';
  const statusClass = isPast ? 'finished' : isActive ? 'running' : 'upcoming';
  return { isPast, isActive, isUpcoming, displayStatus, statusClass };
}

/* ─── Rounds Modal ───────────────────────────────────────────────────────── */
function RoundsModal({ tournament, onClose }) {
  const activeRound = (tournament.rounds || []).find(isRoundActive);
  const roundCount = tournament.rounds?.length || 0;
  const state = deriveTournamentState(tournament);

  const statusColor = state.isActive
    ? { pill: 'bg-amber-400 text-black', dot: 'bg-black', label: 'LIVE NOW' }
    : state.isPast
    ? { pill: 'border border-white/15 bg-white/5 text-white/40', dot: '', label: 'ENDED' }
    : { pill: 'border border-sky-400/30 bg-sky-500/10 text-sky-300', dot: 'bg-sky-400', label: 'UPCOMING' };

  return (
    <div className="t-modal-overlay" onClick={onClose} role="presentation">
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-labelledby="t-modal-title"
        className="t-modal-shell"
        onClick={e => e.stopPropagation()}
        initial={{ opacity: 0, scale: 0.96, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 20 }}
        transition={{ type: 'spring', stiffness: 340, damping: 28 }}
      >
        {/* ── Hero banner ── */}
        <div className="relative w-full h-52 shrink-0 overflow-hidden">
          {tournament.image ? (
            <img
              src={tournament.image}
              alt=""
              className={`w-full h-full object-cover ${state.isPast ? 'grayscale opacity-60' : ''}`}
            />
          ) : (
            <div className="w-full h-full" style={{ background: 'radial-gradient(ellipse at 50% 0%, rgba(212,160,60,0.25), transparent 65%), linear-gradient(180deg,#2a241f,#0d0a06)' }} />
          )}
          {/* gradient fade to body bg */}
          <div className="absolute inset-0 bg-gradient-to-t from-[#0d0a06] via-[#0d0a06]/20 to-transparent" />
          {/* subtle grid texture */}
          <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.04) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.04) 1px,transparent 1px)', backgroundSize: '28px 28px' }} />
          {/* hazard stripe at very top */}
          <div className="absolute top-0 left-0 right-0 h-[3px]" style={{ background: 'repeating-linear-gradient(-45deg,#e8a317,#e8a317 5px,#0d0a06 5px,#0d0a06 10px)' }} />
          {/* status badge */}
          <div className="absolute top-4 left-4">
            <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-russo tracking-[0.3em] font-bold ${statusColor.pill}`}
              style={state.isActive ? { boxShadow: '0 0 18px rgba(245,158,11,0.55)' } : {}}>
              {(state.isActive || state.isUpcoming) && <span className={`w-1.5 h-1.5 rounded-full ${statusColor.dot} ${state.isActive ? 'animate-pulse' : ''}`} />}
              {statusColor.label}
            </div>
          </div>
          {/* close button */}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="absolute top-3 right-3 flex items-center justify-center w-9 h-9 rounded-xl border border-white/15 bg-black/50 backdrop-blur-sm text-white/70 hover:text-white hover:bg-black/70 hover:border-white/30 transition-all"
          >
            <X className="w-4 h-4" strokeWidth={2.5} />
          </button>
        </div>

        {/* ── Scrollable body ── */}
        <div className="flex-1 min-h-0 overflow-y-auto t-modal-scroll px-6 py-5 flex flex-col gap-5">

          {/* Title + date */}
          <div>
            <h3 id="t-modal-title" className="font-orbitron text-xl font-black text-white leading-tight mb-2">
              {tournament.name}
            </h3>
            <div className="flex items-center gap-2 text-white/45 text-xs font-rajdhani">
              <CalendarRange className="w-3.5 h-3.5 shrink-0" />
              {fmtDate(tournament.startDate)} — {fmtDate(tournament.endDate)}
            </div>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Rounds', value: roundCount || '—' },
              { label: 'Status', value: activeRound ? 'Live' : 'Waiting' },
              { label: 'Active Round', value: activeRound ? (activeRound.name || 'In Progress') : '—' },
            ].map(s => (
              <div key={s.label} className="rounded-xl border border-white/8 bg-white/[0.03] px-3 py-3">
                <div className="font-russo text-[9px] tracking-[0.35em] text-amber-300/50 uppercase mb-1">{s.label}</div>
                <div className="font-orbitron text-sm font-black text-white/90 truncate">{s.value}</div>
              </div>
            ))}
          </div>

          {/* Section label */}
          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-white/8" />
            <span className="font-russo text-[9px] tracking-[0.4em] text-amber-300/50 uppercase">Round Schedule</span>
            <div className="h-px flex-1 bg-white/8" />
          </div>

          {/* Rounds list */}
          {(!tournament.rounds || tournament.rounds.length === 0) ? (
            <div className="rounded-xl border border-dashed border-white/10 bg-white/[0.02] px-4 py-8 text-center">
              <Trophy className="w-8 h-8 text-amber-400/30 mx-auto mb-2" />
              <p className="font-russo text-xs text-white/35 tracking-widest">No rounds published yet</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3 pb-2">
              {(tournament.rounds || []).map((round, i) => {
                const active = isRoundActive(round);
                const intervalCount = round?.intervals?.length || 0;
                return (
                  <div
                    key={round.id || i}
                    className="relative rounded-xl overflow-hidden border transition-all"
                    style={active
                      ? { borderColor: 'rgba(74,222,128,0.3)', background: 'linear-gradient(145deg,rgba(34,197,94,0.07),rgba(0,0,0,0.3))' }
                      : { borderColor: 'rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.025)' }
                    }
                  >
                    {/* left accent bar */}
                    <div className="absolute left-0 top-0 bottom-0 w-[3px] rounded-l-xl"
                      style={{ background: active ? 'linear-gradient(180deg,#4ade80,#22c55e)' : 'rgba(245,158,11,0.2)' }} />

                    <div className="pl-4 pr-4 pt-3 pb-3">
                      {/* round header */}
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2.5">
                          <span className="flex items-center justify-center w-6 h-6 rounded-lg text-[11px] font-orbitron font-black shrink-0"
                            style={active
                              ? { background: 'rgba(74,222,128,0.15)', border: '1px solid rgba(74,222,128,0.3)', color: '#86efac' }
                              : { background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(245,158,11,0.2)', color: '#f4cb7b' }
                            }>{i + 1}</span>
                          <span className="font-orbitron text-sm font-bold text-white/90">{round.name || `Round ${i + 1}`}</span>
                        </div>
                        {active ? (
                          <span className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[9px] font-russo tracking-widest font-bold bg-green-500/15 border border-green-400/30 text-green-300">
                            <span className="w-1 h-1 rounded-full bg-green-400 animate-pulse" />LIVE
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 rounded-full text-[9px] font-russo tracking-widest border border-white/10 text-white/35">
                            {intervalCount} slot{intervalCount !== 1 ? 's' : ''}
                          </span>
                        )}
                      </div>

                      {/* intervals */}
                      {round.intervals && round.intervals.length > 0 ? (
                        <div className="flex flex-col gap-2 mt-2">
                          {round.intervals.map((iv, j) => (
                            <div key={j} className="rounded-lg px-3 py-2.5" style={{ background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.06)' }}>
                              <div className="font-russo text-[8px] tracking-[0.35em] text-amber-300/40 mb-1.5 uppercase">Window {j + 1}</div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-rajdhani text-xs text-white/65">{fmtDateTime(iv.startDate)}</span>
                                <span className="font-orbitron text-[10px] text-amber-400/50">→</span>
                                <span className="font-rajdhani text-xs text-white/65">{fmtDateTime(iv.endDate)}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="font-rajdhani text-xs text-white/30 italic mt-1">Schedule TBA</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}

/* ─── Tournament Card ────────────────────────────────────────────────────── */
function TournamentCard({ t, walletAddress }) {
  const [modalOpen, setModalOpen] = useState(false);
  const [myRoundPoints, setMyRoundPoints] = useState(null);
  const [pointsLoading, setPointsLoading] = useState(false);

  const activeRound = (t.rounds || []).find(isRoundActive);
  const state = deriveTournamentState(t);
  const roundCount = t.rounds?.length || 0;

  useEffect(() => {
    if (!walletAddress || !activeRound?.id) { setMyRoundPoints(null); return; }
    let cancelled = false;
    setPointsLoading(true);
    getRoundParticipation(activeRound.id, walletAddress)
      .then((data) => {
        if (cancelled) return;
        setMyRoundPoints(data?.success && typeof data.roundPoints === 'number' ? data.roundPoints : 0);
      })
      .catch(() => { if (!cancelled) setMyRoundPoints(null); })
      .finally(() => { if (!cancelled) setPointsLoading(false); });
    return () => { cancelled = true; };
  }, [walletAddress, activeRound?.id]);

  const pointsLabel = !walletAddress ? '—' : !activeRound ? '—' : pointsLoading ? '…' : myRoundPoints == null ? '—' : String(Math.max(0, myRoundPoints));

  const borderStyle = state.isActive
    ? 'border-amber-400/35 shadow-[0_8px_40px_rgba(245,158,11,0.15)]'
    : state.isPast
    ? 'border-white/8'
    : 'border-white/12 hover:border-amber-400/30 hover:shadow-[0_8px_36px_rgba(245,158,11,0.10)]';

  return (
    <>
      <motion.div
        whileHover={{ y: -5 }}
        transition={{ type: 'spring', stiffness: 340, damping: 26 }}
        className={`group cursor-pointer rounded-2xl overflow-hidden border flex flex-col transition-all duration-300 ${borderStyle}`}
        style={{ background: 'linear-gradient(160deg, #1c1409 0%, #0d0a06 100%)' }}
        onClick={() => setModalOpen(true)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setModalOpen(true); } }}
      >
        {/* Cover image */}
        <div className="relative h-44 overflow-hidden shrink-0">
          {t.image ? (
            <img src={t.image} alt={t.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-amber-900/30 to-black" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-[#0d0a06] via-[#0d0a06]/35 to-transparent" />
          {/* Top-left status badge */}
          <div className="absolute top-3 left-3">
            {state.isActive ? (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-400 text-black shadow-[0_0_18px_rgba(245,158,11,0.5)]">
                <span className="w-1.5 h-1.5 rounded-full bg-black animate-pulse" />
                <span className="font-russo text-[9px] tracking-[0.3em] font-bold">LIVE</span>
              </div>
            ) : state.isPast ? (
              <div className="px-3 py-1.5 rounded-full border border-white/15 bg-black/50 backdrop-blur-sm">
                <span className="font-russo text-[9px] tracking-[0.3em] text-white/40">ENDED</span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-sky-400/30 bg-sky-500/10 backdrop-blur-sm">
                <span className="w-1.5 h-1.5 rounded-full bg-sky-400" />
                <span className="font-russo text-[9px] tracking-[0.3em] text-sky-300">UPCOMING</span>
              </div>
            )}
          </div>
          {/* Top-right rounds badge */}
          {roundCount > 0 && (
            <div className="absolute top-3 right-3 px-2.5 py-1 rounded-full border border-white/12 bg-black/50 backdrop-blur-sm">
              <span className="font-russo text-[9px] text-white/50 tracking-widest">{roundCount} RDS</span>
            </div>
          )}
        </div>

        {/* Body */}
        <div className="flex flex-col flex-1 p-4 gap-3">
          {/* Name */}
          <h3 className="font-orbitron text-base font-black text-white/95 group-hover:text-amber-300 transition-colors duration-200 leading-tight line-clamp-2">
            {t.name}
          </h3>

          {/* Date */}
          <div className="flex items-center gap-1.5">
            <CalendarRange className="w-3 h-3 text-white/35 shrink-0" />
            <span className="font-rajdhani text-xs text-white/40">{fmtDate(t.startDate)} — {fmtDate(t.endDate)}</span>
          </div>

          {/* Active round bar */}
          {activeRound && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-green-500/20 bg-green-500/6">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse shrink-0" />
              <span className="font-russo text-[10px] tracking-widest text-green-300 truncate">{activeRound.name || 'Active Round'}</span>
            </div>
          )}

          {/* Points row — only if wallet connected and round is active */}
          {walletAddress && activeRound && (
            <div className="flex items-center justify-between px-3 py-2 rounded-lg border border-amber-400/15 bg-amber-400/5">
              <span className="font-russo text-[9px] tracking-[0.35em] text-amber-400/60 uppercase">Your Coins</span>
              <span className="font-orbitron text-sm font-black text-amber-300">{pointsLabel}</span>
            </div>
          )}

          <div className="mt-auto pt-1">
            <div className="h-px bg-white/6 mb-3" />
            <div className="flex items-center justify-between">
              <span className={`font-russo text-[10px] tracking-[0.3em] uppercase ${state.isActive ? 'text-amber-400/80' : state.isPast ? 'text-white/25' : 'text-sky-400/60'}`}>
                {state.isActive ? 'Enter Now' : state.isPast ? 'View Results' : 'Register'}
              </span>
              <div className={`flex h-7 w-7 items-center justify-center rounded-full border transition-all duration-200 ${state.isActive ? 'border-amber-400/35 bg-amber-400/10 group-hover:bg-amber-400/20' : 'border-white/12 bg-white/5 group-hover:border-amber-400/25'}`}>
                <Star className={`w-3 h-3 ${state.isActive ? 'text-amber-400' : 'text-white/35 group-hover:text-amber-400/60'}`} />
              </div>
            </div>
          </div>
        </div>
      </motion.div>
      {modalOpen && <RoundsModal tournament={t} onClose={() => setModalOpen(false)} />}
    </>
  );
}

/* ─── Tournament Section ─────────────────────────────────────────────────── */
function TournamentSection({ title, tournaments, walletAddress }) {
  if (!tournaments || tournaments.length === 0) return null;
  const isActive = title.toLowerCase().includes('active');
  return (
    <section className="mb-10">
      <div className="flex items-center gap-3 mb-5">
        {isActive && <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse shrink-0" style={{ boxShadow: '0 0 8px rgba(245,158,11,0.7)' }} />}
        <div className="h-px w-4 bg-amber-400/50 rounded-full" />
        <h2 className="font-russo text-xs tracking-[0.4em] text-amber-300/80 uppercase">{title}</h2>
        <div className="h-px flex-1 bg-gradient-to-r from-amber-400/20 to-transparent rounded-full" />
      </div>
      <div className="t-cards-grid">
        {tournaments.map(t => (
          <TournamentCard key={t.id} t={t} walletAddress={walletAddress} />
        ))}
      </div>
    </section>
  );
}

function TournamentSkeletonCard() {
  return (
    <div className="t-card t-card--skeleton" aria-hidden="true">
      <div className="wz-skeleton t-skeleton-cover" />

      <div className="t-card-status-row">
        <div className="wz-skeleton t-skeleton-pill" />
        <div className="wz-skeleton t-skeleton-meta" />
      </div>

      <div className="t-card-top">
        <div className="t-card-info">
          <div className="wz-skeleton t-skeleton-title" />
          <div className="wz-skeleton t-skeleton-date" />
          <div className="wz-skeleton t-skeleton-rounds" />
        </div>
      </div>

      <div className="wz-skeleton t-skeleton-strip" />

      <div className="t-card-meta-grid">
        <div className="t-card-meta-box">
          <div className="wz-skeleton t-skeleton-box-label" />
          <div className="wz-skeleton t-skeleton-box-value" />
        </div>
        <div className="t-card-meta-box">
          <div className="wz-skeleton t-skeleton-box-label" />
          <div className="wz-skeleton t-skeleton-box-value" />
        </div>
        <div className="t-card-meta-box">
          <div className="wz-skeleton t-skeleton-box-label" />
          <div className="wz-skeleton t-skeleton-box-value" />
        </div>
      </div>

      <div className="t-card-actions">
        <div className="wz-skeleton t-skeleton-action t-skeleton-action--secondary w-full" />
      </div>
    </div>
  );
}

function TournamentSkeletonSection({ title, count = 2 }) {
  return (
    <section className="t-section t-section--skeleton" aria-hidden="true">
      <div className="t-section-title t-section-title--skeleton">{title}</div>
      <div className="t-cards-grid">
        {Array.from({ length: count }, (_, idx) => (
          <TournamentSkeletonCard key={`${title}-${idx}`} />
        ))}
      </div>
    </section>
  );
}

/* ─── Page ───────────────────────────────────────────────────────────────── */
export default function InterversePlayPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { address, isConnected, disconnect } = useWallet();
  const openLogin = () => navigate('/login', { state: { from: location.pathname } });
  const [tournaments, setTournaments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    setError('');
    trace('load:start');
    getTournaments()
      .then((res) => {
        trace('load:getTournaments:response', { status: res?.status, hasData: Boolean(res?.body?.data) });
        if (!res?.body?.data) throw new Error(res?.body?.message || 'No tournaments found');
        setTournaments(res.body.data);
        trace('load:getTournaments:success', { count: Array.isArray(res.body.data) ? res.body.data.length : 0 });
      })
      .catch((e) => {
        trace('load:getTournaments:error', e);
        setError(e.message);
      })
      .finally(() => {
        trace('load:done');
        setLoading(false);
      });
  }, []);

  useEffect(() => { load(); }, [load]);

  const active = tournaments.filter(t => t.status === 'RUNNING');
  const upcoming = tournaments.filter(t => t.status === 'UPCOMING');
  const previous = tournaments.filter(t => t.status === 'FINISHED');
  const hasKnownStatus = active.length + upcoming.length + previous.length > 0;
  const others = hasKnownStatus ? [] : tournaments;

  return (
    <>
      <div className="min-h-screen bg-background relative overflow-x-hidden pb-36 sm:pb-0">
        <div className="fixed inset-0 z-0">
          <video autoPlay muted loop playsInline className="w-full h-full object-cover opacity-30">
            <source src="/videos/war-scene.mp4" type="video/mp4" />
          </video>
          <div className="absolute inset-0 bg-background/70" />
          <div className="absolute inset-0 bg-gradient-to-b from-background/50 via-background/60 to-background/95" />
        </div>

        <header className="fixed top-0 left-0 right-0 z-50">
          <div className="bg-background/95 backdrop-blur-md border-b border-border">
            <div className="container mx-auto px-4 relative flex items-center justify-between h-14 sm:h-16">
              <Link to="/" className="relative z-10 shrink-0">
                <motion.div
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg bg-card/50 border border-border hover:border-gold transition-all group"
                >
                  <ArrowLeft className="w-4 h-4 text-muted-foreground group-hover:text-gold transition-colors" />
                  <Home className="w-4 h-4 text-muted-foreground group-hover:text-gold transition-colors" />
                  <span className="font-russo text-xs text-muted-foreground group-hover:text-gold transition-colors hidden sm:block">
                    HOME
                  </span>
                </motion.div>
              </Link>
              <div className="pointer-events-none absolute left-1/2 top-1/2 z-0 flex max-w-[calc(100%-120px)] -translate-x-1/2 -translate-y-1/2 items-center justify-center gap-2 px-2 text-center sm:max-w-none">
                <Trophy className="w-4 h-4 sm:w-6 sm:h-6 shrink-0 text-gold animate-pulse-glow" />
                <h1 className="font-orbitron text-sm sm:text-lg md:text-xl font-bold leading-none text-gradient-sunset whitespace-nowrap">TOURNAMENTS</h1>
              </div>
              <div className="relative z-10 hidden sm:block">
                <PageWalletControls
                  isConnected={isConnected}
                  address={address}
                  onDisconnect={disconnect}
                  onRequestLogin={openLogin}
                />
              </div>
            </div>
            <div
              className="h-[2px]"
              style={{
                background:
                  'linear-gradient(90deg, transparent, hsl(42,100%,50%) 30%, hsl(42,100%,50%) 70%, transparent)',
              }}
            />
          </div>
        </header>

        <div className="relative z-10 pt-14 sm:pt-16">
          <div className="hazard-stripe-sm h-3" />
          <div
            className="overflow-hidden py-3 border-b border-gold/20"
            style={{
              background: 'linear-gradient(90deg, hsl(20,35%,6%) 0%, hsl(20,30%,10%) 50%, hsl(20,35%,6%) 100%)',
            }}
          >
            <div className="flex animate-marquee whitespace-nowrap">
              {[...TOURNAMENT_MARQUEE_ITEMS, ...TOURNAMENT_MARQUEE_ITEMS].map((item, i) => (
                <span key={`${item}-${i}`} className="flex items-center mx-6 sm:mx-10">
                  <Star className="w-3 h-3 text-gold mr-2" fill="hsl(42,100%,50%)" />
                  <span className="font-orbitron text-sm sm:text-base font-black text-foreground tracking-wider">
                    {item}
                  </span>
                </span>
              ))}
            </div>
          </div>

          <section className="relative overflow-hidden">
            <div className="scan-line" />
            <motion.img
              src={decoLamp}
              alt=""
              className="absolute right-2 top-4 w-10 sm:w-14 z-[1] opacity-40 pointer-events-none"
              animate={{
                filter: [
                  'drop-shadow(0 0 12px hsl(28,100%,50%,0.5))',
                  'drop-shadow(0 0 24px hsl(28,100%,50%,0.8))',
                  'drop-shadow(0 0 12px hsl(28,100%,50%,0.5))',
                ],
              }}
              transition={{ duration: 3, repeat: Infinity }}
              loading="lazy"
            />
            <img
              src={decoChain}
              alt=""
              className="absolute left-2 top-1/4 w-5 z-[1] hidden xl:block opacity-20 pointer-events-none"
              loading="lazy"
            />

            <div className="container mx-auto px-4 relative z-10 pb-28 pt-6 sm:pt-8">
              {loading && (
                <div className="t-loading-state">
                  <p className="wz-loading-label">Loading tournaments</p>
                  <TournamentSkeletonSection title="Active Tournaments" count={2} />
                  <TournamentSkeletonSection title="Upcoming Tournaments" count={2} />
                </div>
              )}
              {error && <div className="intraverse-feedback-card error">{error}</div>}

              {!loading && !error && (
                <>
                  <TournamentSection title="Active Tournaments" tournaments={active} walletAddress={address} />
                  <TournamentSection title="Upcoming Tournaments" tournaments={upcoming} walletAddress={address} />
                  <TournamentSection title="Previous Tournaments" tournaments={previous} walletAddress={address} />
                  <TournamentSection title="Tournament" tournaments={others} walletAddress={address} />
                  {tournaments.length === 0 && (
                    <div className="intraverse-feedback-card">No tournaments found.</div>
                  )}
                </>
              )}
            </div>

            <img
              src={decoRubble}
              alt=""
              className="absolute bottom-0 left-0 w-36 sm:w-52 z-[1] opacity-25 pointer-events-none"
              loading="lazy"
            />
            <img
              src={decoRubble}
              alt=""
              className="absolute bottom-0 right-0 w-28 sm:w-44 z-[1] opacity-15 pointer-events-none -scale-x-100"
              loading="lazy"
            />
          </section>
        </div>
      </div>

      <MobileBottomNav current="tournament" />
    </>
  );
}
