import type { HardcodedTournament } from '@/constants/tournaments';

export type TournamentDisplayStatus = 'ACTIVE' | 'UPCOMING' | 'ENDED';

export type TournamentState = {
  isPast: boolean;
  isActive: boolean;
  isUpcoming: boolean;
  displayStatus: TournamentDisplayStatus;
  statusClass: 'running' | 'upcoming' | 'finished';
};

export function fmtTournamentDate(ms?: number) {
  if (!ms) return 'TBA';
  return new Date(ms).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

export function fmtTournamentDateTime(ms?: number) {
  if (!ms) return 'TBA';
  return new Date(ms).toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function deriveTournamentState(tournament: {
  startDate?: number;
  endDate?: number;
  status?: string;
}): TournamentState {
  const now = Date.now();
  const startMs = Number(tournament?.startDate || 0);
  const endMs = Number(tournament?.endDate || 0);
  const normalizedStatus = String(tournament?.status || '').toUpperCase();
  const isLiveStatus = ['RUNNING', 'ACTIVE', 'LIVE', 'IN_PROGRESS'].includes(normalizedStatus);
  const isEndedStatus = ['COMPLETED', 'ENDED', 'FINISHED', 'DONE', 'CLOSED'].includes(normalizedStatus);
  const isUpcomingStatus = ['UPCOMING', 'SCHEDULED', 'PENDING'].includes(normalizedStatus);
  const isPast = isEndedStatus || (Number.isFinite(endMs) && endMs > 0 && endMs < now);
  const isActive =
    !isPast &&
    (isLiveStatus ||
      (Number.isFinite(startMs) &&
        startMs > 0 &&
        Number.isFinite(endMs) &&
        endMs > 0 &&
        startMs <= now &&
        now <= endMs));
  const isUpcoming =
    !isPast && !isActive && (isUpcomingStatus || (Number.isFinite(startMs) && startMs > now));
  const displayStatus: TournamentDisplayStatus = isPast ? 'ENDED' : isActive ? 'ACTIVE' : 'UPCOMING';
  const statusClass = isPast ? 'finished' : isActive ? 'running' : 'upcoming';
  return { isPast, isActive, isUpcoming, displayStatus, statusClass };
}

export function partitionTournaments<T extends HardcodedTournament>(tournaments: T[]) {
  const active: T[] = [];
  const upcoming: T[] = [];
  const previous: T[] = [];

  for (const t of tournaments) {
    const state = deriveTournamentState(t);
    if (state.isActive) active.push(t);
    else if (state.isUpcoming) upcoming.push(t);
    else previous.push(t);
  }

  return { active, upcoming, previous };
}

export function isRoundActive(round?: {
  intervals?: Array<{ startDate: number; endDate: number }>;
}) {
  if (!Array.isArray(round?.intervals) || round.intervals.length === 0) return false;
  const now = Date.now();
  return round.intervals.some((iv) => now >= iv.startDate && now <= iv.endDate);
}
