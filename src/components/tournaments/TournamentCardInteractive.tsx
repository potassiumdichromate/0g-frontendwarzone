import { useEffect, useState } from 'react';
import type { HardcodedTournament } from '@/constants/tournaments';
import { getRoundParticipation } from '@/utils/api';
import { deriveTournamentState, isRoundActive } from '@/lib/tournamentState';
import { TournamentCard } from './TournamentCard';

type TournamentCardInteractiveProps = {
  tournament: HardcodedTournament;
  walletAddress?: string;
  index?: number;
  onOpenModal: (tournament: HardcodedTournament) => void;
};

/** Tournament page card — opens rounds modal; fetches live round points when applicable. */
export function TournamentCardInteractive({
  tournament: t,
  walletAddress,
  index = 0,
  onOpenModal,
}: TournamentCardInteractiveProps) {
  const state = deriveTournamentState(t);
  const activeRound = (t.rounds || []).find(isRoundActive);
  const [myRoundPoints, setMyRoundPoints] = useState<number | null>(null);
  const [pointsLoading, setPointsLoading] = useState(false);

  useEffect(() => {
    if (!walletAddress || !activeRound?.id || !state.isActive) {
      setMyRoundPoints(null);
      return;
    }
    let cancelled = false;
    setPointsLoading(true);
    getRoundParticipation(activeRound.id, walletAddress)
      .then((data) => {
        if (cancelled) return;
        setMyRoundPoints(
          data?.success && typeof data.roundPoints === 'number' ? data.roundPoints : 0,
        );
      })
      .catch(() => {
        if (!cancelled) setMyRoundPoints(null);
      })
      .finally(() => {
        if (!cancelled) setPointsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [walletAddress, activeRound?.id, state.isActive]);

  const livePoints =
    walletAddress && state.isActive && activeRound
      ? pointsLoading
        ? '…'
        : myRoundPoints == null
          ? '—'
          : String(Math.max(0, myRoundPoints))
      : null;

  return (
    <TournamentCard
      tournament={t}
      index={index}
      onClick={() => onOpenModal(t)}
      livePoints={livePoints}
    />
  );
}

export default TournamentCardInteractive;
