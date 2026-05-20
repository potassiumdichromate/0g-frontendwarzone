/** Hardcoded live tournaments (no API). */
export type TournamentRound = {
  id: string;
  name?: string;
  title?: string;
  tournamentId?: string;
  intervals?: Array<{ startDate: number; endDate: number }>;
};

export type HardcodedTournament = {
  id: string;
  name: string;
  color?: string;
  image: string;
  startDate: number;
  endDate: number;
  slug?: string;
  status?: string;
  interestedCount?: number;
  totalWinners?: number;
  totalPrize?: number;
  rounds: TournamentRound[];
};

export const HARDCODED_TOURNAMENTS: HardcodedTournament[] = [
  {
    id: 'CuaSI4mLJeC1IwDsnWGp',
    name: 'Warm Up Tournament Warzone warriors X INTRAVERSE',
    color: '#2196f3',
    image:
      'https://firebasestorage.googleapis.com/v0/b/intraverse-3aa8e.appspot.com/o/images%2Fd5d3d36b-f328-4d30-926f-29f3ea88f626-png?alt=media&token=028b0a5a-621d-4364-a5e3-f88f563a0b2f',
    startDate: 1775653177710,
    endDate: 1775667697710,
    slug: 'warm-up-tournament-warzone-warriors-x-intraverse',
    totalWinners: 50,
    totalPrize: 0,
    interestedCount: 14,
    rounds: [
      {
        id: '8rQMjIAossyQepJTGmJm',
        name: 'Warm Up Tournament Warzone warriors X INTRAVERSE',
        title: 'Round 1',
        tournamentId: 'CuaSI4mLJeC1IwDsnWGp',
        intervals: [{ startDate: 1775653200000, endDate: 1775667600000 }],
      },
    ],
  },
  {
    id: '7mLKlHproJLiBTJ1t0c2',
    name: 'TOKYO NIGHTS X WARZONE WARRIORS',
    color: '#2196f3',
    image:
      'https://firebasestorage.googleapis.com/v0/b/intraverse-3aa8e.appspot.com/o/images%2Fde925f28-07b9-449f-96c0-60d83cad7d80-png?alt=media&token=1701dd68-1539-4fbe-b2c2-0c7820c5ac1f',
    startDate: 1775739585031,
    endDate: 1775998905031,
    slug: 'tokyo-nights-x-warzone-warriors',
    totalWinners: 100,
    totalPrize: 500,
    interestedCount: 25,
    rounds: [
      {
        id: 'pEY2fMLeMDGggVNqHJOY',
        name: 'TOKYO NIGHTS | ARCADE #4',
        title: 'ROUND1',
        tournamentId: '7mLKlHproJLiBTJ1t0c2',
        intervals: [{ startDate: 1775739600000, endDate: 1775998800000 }],
      },
    ],
  },
];

/** Shape expected by legacy tournament list consumers (`res.body.data`). */
export function getHardcodedTournamentsResponse() {
  return { status: 200, body: { data: HARDCODED_TOURNAMENTS } };
}
