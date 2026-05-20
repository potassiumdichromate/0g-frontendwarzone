import { motion } from 'framer-motion';
import { Radar } from 'lucide-react';
import { TournamentComingSoonCard } from './TournamentComingSoonCard';

type TournamentDeployingSectionProps = {
  showCards?: boolean;
  cardCount?: number;
};

export function TournamentDeployingSection({
  showCards = true,
  cardCount = 2,
}: TournamentDeployingSectionProps) {
  return (
    <section className="mb-10">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="rounded-2xl border border-gold/25 bg-gradient-to-r from-[#1c1508]/90 via-card/40 to-[#0e0b06]/90 px-5 py-5 sm:px-6 sm:py-6 mb-6"
        style={{ boxShadow: '0 0 32px rgba(255, 215, 60, 0.06)' }}
      >
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-gold/25 bg-gold/10">
            <Radar className="w-6 h-6 text-gold" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-russo text-[10px] tracking-[0.35em] text-gold/70 uppercase mb-1">
              Next deployment wave
            </p>
            <h2 className="font-orbitron text-lg sm:text-xl font-black text-foreground mb-1">
              New tournaments are coming soon
            </h2>
            <p className="font-rajdhani text-sm text-muted-foreground leading-relaxed">
              All current brackets have ended. We&apos;re lining up the next Warzone circuit — check back
              for fresh rounds, prizes, and leaderboard resets.
            </p>
          </div>
        </div>
      </motion.div>

      {showCards && (
        <>
          <div className="flex items-center gap-3 mb-5">
            <div className="h-px w-4 bg-gold/50 rounded-full" />
            <h3 className="font-russo text-xs tracking-[0.4em] text-gold/80 uppercase">
              Deploying Soon
            </h3>
            <div className="h-px flex-1 bg-gradient-to-r from-gold/20 to-transparent rounded-full" />
          </div>
          <div className="t-cards-grid">
            {Array.from({ length: cardCount }, (_, i) => (
              <TournamentComingSoonCard key={i} delay={i * 0.06} />
            ))}
          </div>
        </>
      )}
    </section>
  );
}

export default TournamentDeployingSection;
