import { motion } from 'framer-motion';
import {
  ArrowRight,
  CalendarDays,
  Crown,
  Flag,
  Layers,
  Trophy,
  Users,
} from 'lucide-react';
import type { HardcodedTournament } from '@/constants/tournaments';
import { deriveTournamentState, fmtTournamentDate, isRoundActive } from '@/lib/tournamentState';

export type TournamentCardProps = {
  tournament: HardcodedTournament;
  index?: number;
  className?: string;
  onClick?: () => void;
  /** When true, card is not interactive (ended archive view on home preview). */
  disableHoverLift?: boolean;
  /** Live round coin tally (tournaments hub, wallet connected). */
  livePoints?: string | null;
};

export function TournamentCard({
  tournament: t,
  index = 0,
  className = '',
  onClick,
  disableHoverLift = false,
  livePoints = null,
}: TournamentCardProps) {
  const state = deriveTournamentState(t);
  const roundCount = (t.rounds || []).length;
  const activeRound = (t.rounds || []).find(isRoundActive);
  const winners = t.totalWinners ?? 0;
  const prize = t.totalPrize ?? 0;
  const interested = t.interestedCount ?? 0;

  const borderClass = state.isActive
    ? 'border-gold/40 shadow-[0_8px_40px_rgba(255,215,60,0.15),0_0_0_1px_rgba(255,215,60,0.08)]'
    : state.isPast
      ? 'border-border/50 opacity-[0.97]'
      : 'border-gold/20 hover:border-gold/35 hover:shadow-[0_8px_36px_rgba(255,215,60,0.1)]';

  const ctaLabel = state.isActive
    ? 'Enter Now'
    : state.isPast
      ? 'Tournament Ended'
      : 'Opens Soon';

  const footnote = state.isPast
    ? 'This bracket has concluded. Final standings are on the tournaments hub.'
    : state.isUpcoming
      ? 'Registration opens when the window goes live.'
      : activeRound
        ? `Live round: ${activeRound.title || activeRound.name || 'Active'}`
        : 'Compete for glory on the Warzone circuit.';

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: index * 0.08 }}
      whileHover={disableHoverLift ? undefined : { y: -6 }}
      className={`group h-full ${onClick ? 'cursor-pointer' : ''} ${className}`}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
    >
      <div
        className={`relative h-full flex flex-col rounded-2xl overflow-hidden border transition-all duration-300 ${borderClass}`}
        style={{ background: 'linear-gradient(160deg, #1c1508 0%, #0e0b06 100%)' }}
      >
        <div
          className="absolute top-0 left-0 right-0 h-[3px] z-20"
          style={{
            background: state.isPast
              ? 'linear-gradient(90deg, transparent, rgba(255,255,255,0.15) 50%, transparent)'
              : 'repeating-linear-gradient(-45deg,#e8a317,#e8a317 5px,#0d0a06 5px,#0d0a06 10px)',
          }}
        />

        {/* Cover */}
        <div className="relative h-44 sm:h-48 overflow-hidden shrink-0">
          {t.image ? (
            <img
              src={t.image}
              alt={t.name}
              className={`w-full h-full object-cover transition-transform duration-700 ${
                state.isPast ? 'grayscale-[0.65] brightness-[0.55]' : 'group-hover:scale-105'
              }`}
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-gold/20 to-background" />
          )}
          <div
            className={`absolute inset-0 bg-gradient-to-t from-[#0e0b06] via-[#0e0b06]/50 to-transparent ${
              state.isPast ? 'via-[#0e0b06]/75' : ''
            }`}
          />


          <div className="absolute top-3 left-3 z-10">
            {state.isActive ? (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gold text-background shadow-[0_0_16px_rgba(255,215,60,0.45)]">
                <span className="w-1.5 h-1.5 rounded-full bg-background animate-pulse" />
                <span className="font-russo text-[9px] tracking-[0.3em] font-bold">LIVE</span>
              </div>
            ) : state.isPast ? (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-red-500/50 bg-red-500/15 backdrop-blur-sm shadow-[0_0_12px_rgba(239,68,68,0.3)]">
                <Flag className="w-3 h-3 text-red-400" />
                <span className="font-russo text-[9px] tracking-[0.3em] text-red-400">ENDED</span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-gold/35 bg-gold/10 backdrop-blur-sm">
                <Crown className="w-3 h-3 text-gold" />
                <span className="font-russo text-[9px] tracking-[0.3em] text-gold">UPCOMING</span>
              </div>
            )}
          </div>

          {roundCount > 0 && (
            <div className="absolute top-3 right-3 z-10 px-2.5 py-1 rounded-full border border-white/12 bg-black/50 backdrop-blur-sm">
              <span className="font-russo text-[9px] text-white/55 tracking-widest">
                {roundCount} {roundCount === 1 ? 'RD' : 'RDS'}
              </span>
            </div>
          )}

          <div className="absolute inset-x-0 bottom-0 p-4 z-10">
            <h3
              className={`font-orbitron text-base sm:text-lg font-black leading-tight line-clamp-2 transition-colors ${
                state.isPast ? 'text-white/75' : 'text-foreground group-hover:text-gold'
              }`}
            >
              {t.name}
            </h3>
          </div>
        </div>

        {/* Body */}
        <div className="flex flex-col flex-1 p-4 sm:p-5 gap-3">
          <div className="flex items-center gap-1.5">
            <CalendarDays className="w-3.5 h-3.5 text-muted-foreground/70 shrink-0" />
            <span className="font-rajdhani text-xs text-muted-foreground">
              {fmtTournamentDate(t.startDate)} — {fmtTournamentDate(t.endDate)}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-xl border border-border/60 bg-background/30 px-2.5 py-2 text-center">
              <Layers className="w-3 h-3 text-gold/60 mx-auto mb-1" />
              <div className="font-russo text-[8px] tracking-widest text-muted-foreground uppercase">Rounds</div>
              <div className="font-orbitron text-sm font-bold text-foreground">{roundCount}</div>
            </div>
            <div className="rounded-xl border border-border/60 bg-background/30 px-2.5 py-2 text-center">
              <Users className="w-3 h-3 text-gold/60 mx-auto mb-1" />
              <div className="font-russo text-[8px] tracking-widest text-muted-foreground uppercase">Winners</div>
              <div className="font-orbitron text-sm font-bold text-foreground">{winners || '—'}</div>
            </div>
            <div className="rounded-xl border border-border/60 bg-background/30 px-2.5 py-2 text-center">
              <Trophy className="w-3 h-3 text-gold/60 mx-auto mb-1" />
              <div className="font-russo text-[8px] tracking-widest text-muted-foreground uppercase">Prize</div>
              <div className="font-orbitron text-sm font-bold text-gold">{prize > 0 ? prize : 'TBA'}</div>
            </div>
          </div>

          {interested > 0 && (
            <p className="font-rajdhani text-[11px] text-muted-foreground/90 -mt-1">
              {interested} warriors marked interested
            </p>
          )}

          <p className="font-rajdhani text-xs text-muted-foreground leading-relaxed line-clamp-2">
            {footnote}
          </p>

          {livePoints != null && (
            <div className="flex items-center justify-between px-3 py-2 rounded-lg border border-gold/20 bg-gold/5">
              <span className="font-russo text-[9px] tracking-[0.35em] text-gold/60 uppercase">
                Your Coins
              </span>
              <span className="font-orbitron text-sm font-black text-gold">{livePoints}</span>
            </div>
          )}

          <div className="mt-auto pt-1">
            <div className="h-px bg-white/6 mb-3" />
            <div className="flex items-center justify-between gap-2">
              <span
                className={`font-russo text-[10px] tracking-[0.28em] uppercase ${
                  state.isActive
                    ? 'text-gold'
                    : state.isPast
                      ? 'text-white/35'
                      : 'text-gold/70'
                }`}
              >
                {ctaLabel}
              </span>
              <div
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border transition-all duration-200 ${
                  state.isActive
                    ? 'border-gold/40 bg-gold/10 group-hover:bg-gold/20'
                    : 'border-white/12 bg-white/5 group-hover:border-gold/30'
                }`}
              >
                <ArrowRight
                  className={`w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5 ${
                    state.isActive ? 'text-gold' : 'text-white/45 group-hover:text-gold/70'
                  }`}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

export default TournamentCard;
