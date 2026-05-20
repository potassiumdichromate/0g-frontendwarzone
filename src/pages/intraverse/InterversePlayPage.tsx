import { useEffect, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Home, Trophy, Star, X, CalendarRange, Layers } from 'lucide-react';
import { getTournaments } from '../../utils/api';
import { useWallet } from '../../contexts/WalletContext';
import MobileBottomNav from '../../components/MobileBottomNav';
import PageWalletControls from '../../components/PageWalletControls';
import { TournamentCardInteractive } from '@/components/tournaments/TournamentCardInteractive';
import { TournamentDeployingSection } from '@/components/tournaments/TournamentDeployingSection';
import {
  deriveTournamentState,
  fmtTournamentDate,
  fmtTournamentDateTime,
  isRoundActive,
  partitionTournaments,
} from '@/lib/tournamentState';
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
        <div className="relative w-full h-32 sm:h-36 shrink-0 overflow-hidden">
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
        <div className="t-modal-scroll px-5 sm:px-6 py-4 flex flex-col gap-3 sm:gap-4">

          {/* Title + date */}
          <div>
            <h3 id="t-modal-title" className="font-orbitron text-xl font-black text-white leading-tight mb-2">
              {tournament.name}
            </h3>
            <div className="flex items-center gap-2 text-white/45 text-xs font-rajdhani">
              <CalendarRange className="w-3.5 h-3.5 shrink-0" />
              {fmtTournamentDate(tournament.startDate)} — {fmtTournamentDate(tournament.endDate)}
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
            <div className="flex flex-col gap-3">
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
                                <span className="font-rajdhani text-xs text-white/65">{fmtTournamentDateTime(iv.startDate)}</span>
                                <span className="font-orbitron text-[10px] text-amber-400/50">→</span>
                                <span className="font-rajdhani text-xs text-white/65">{fmtTournamentDateTime(iv.endDate)}</span>
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

/* ─── Tournament Section ─────────────────────────────────────────────────── */
function TournamentSection({ title, tournaments, walletAddress, onOpenModal, subtitle }) {
  if (!tournaments || tournaments.length === 0) return null;
  const isActive = title.toLowerCase().includes('active');
  return (
    <section className="mb-10">
      <div className="flex items-center gap-3 mb-2">
        {isActive && (
          <span
            className="w-2 h-2 rounded-full bg-gold animate-pulse shrink-0"
            style={{ boxShadow: '0 0 8px hsl(42, 100%, 50%, 0.7)' }}
          />
        )}
        <div className="h-px w-4 bg-gold/50 rounded-full" />
        <h2 className="font-russo text-xs tracking-[0.4em] text-gold/80 uppercase">{title}</h2>
        <div className="h-px flex-1 bg-gradient-to-r from-gold/20 to-transparent rounded-full" />
      </div>
      {subtitle && (
        <p className="font-rajdhani text-sm text-muted-foreground mb-5 pl-0 sm:pl-6">{subtitle}</p>
      )}
      <div className="t-cards-grid">
        {tournaments.map((t, i) => (
          <TournamentCardInteractive
            key={t.id}
            tournament={t}
            index={i}
            walletAddress={walletAddress}
            onOpenModal={onOpenModal}
          />
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
  const [modalTournament, setModalTournament] = useState(null);

  useEffect(() => {
    if (!modalTournament) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [modalTournament]);

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

  const { active, upcoming, previous } = partitionTournaments(tournaments);
  const hasLiveOrUpcoming = active.length > 0 || upcoming.length > 0;

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
                  <TournamentSection
                    title="Active Tournaments"
                    tournaments={active}
                    walletAddress={address}
                    onOpenModal={setModalTournament}
                  />
                  <TournamentSection
                    title="Upcoming Tournaments"
                    tournaments={upcoming}
                    walletAddress={address}
                    onOpenModal={setModalTournament}
                  />

                  {!hasLiveOrUpcoming && tournaments.length > 0 && (
                    <TournamentDeployingSection cardCount={2} />
                  )}

                  <TournamentSection
                    title="Previous Tournaments"
                    tournaments={previous}
                    walletAddress={address}
                    onOpenModal={setModalTournament}
                    subtitle="These brackets have ended. New tournaments are coming soon."
                  />

                  {tournaments.length === 0 && (
                    <div className="space-y-8">
                      <div className="intraverse-feedback-card text-center py-10">
                        <p className="font-orbitron text-lg font-black text-foreground mb-2">
                          No tournaments yet
                        </p>
                        <p className="font-rajdhani text-sm text-muted-foreground">
                          The Warzone circuit is being prepared. Check back soon.
                        </p>
                      </div>
                      <TournamentDeployingSection cardCount={2} />
                    </div>
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

      {modalTournament &&
        createPortal(
          <RoundsModal
            tournament={modalTournament}
            onClose={() => setModalTournament(null)}
          />,
          document.body,
        )}

      <MobileBottomNav current="tournament" />
    </>
  );
}
