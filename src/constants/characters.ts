import soldierCard from '@/assets/soldier-card-1-clean.png';
import characterTwo from '@/assets/character2.png';
import characterThree from '@/assets/character3.png';

export type WarriorCharacter = {
  name: string;
  titleBase: string;
  titleHighlight: string;
  description: string;
  stats: Array<{ label: string; value: number; color: string }>;
  image: string;
  locks: string[];
  scale: number;
};

export const WARRIOR_CHARACTERS: WarriorCharacter[] = [
  {
    name: 'HANDSOME MAN',
    titleBase: 'HANDSOME',
    titleHighlight: 'MAN',
    description:
      'The original warrior. Equipped with a trusty pistol, red bandana, and unstoppable attitude.',
    stats: [
      { label: 'DAMAGE', value: 65, color: 'hsl(28,100%,50%)' },
      { label: 'SPEED', value: 80, color: 'hsl(42,100%,50%)' },
      { label: 'DEFENSE', value: 45, color: 'hsl(100,40%,35%)' },
    ],
    image: soldierCard,
    locks: ['Shadow Dancer', 'Oldman Tracer'],
    scale: 1,
  },
  {
    name: 'SHADOW DANCER',
    titleBase: 'SHADOW',
    titleHighlight: 'DANCER',
    description:
      'A stealthy ninja warrior. Strikes from the darkness with lethal precision and unmatched agility.',
    stats: [
      { label: 'DAMAGE', value: 85, color: 'hsl(28,100%,50%)' },
      { label: 'SPEED', value: 95, color: 'hsl(42,100%,50%)' },
      { label: 'DEFENSE', value: 30, color: 'hsl(100,40%,35%)' },
    ],
    image: characterTwo,
    locks: ['Handsome Man', 'Oldman Tracer'],
    scale: 1.4,
  },
  {
    name: 'OLDMAN TRACER',
    titleBase: 'OLDMAN',
    titleHighlight: 'TRACER',
    description:
      'A grizzled veteran with heavy firepower. Slow but packs a massive punch and impenetrable armor.',
    stats: [
      { label: 'DAMAGE', value: 95, color: 'hsl(28,100%,50%)' },
      { label: 'SPEED', value: 40, color: 'hsl(42,100%,50%)' },
      { label: 'DEFENSE', value: 85, color: 'hsl(100,40%,35%)' },
    ],
    image: characterThree,
    locks: ['Handsome Man', 'Shadow Dancer'],
    scale: 1.4,
  },
];
