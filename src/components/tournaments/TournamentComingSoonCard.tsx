import { motion } from 'framer-motion';
import { Crosshair, Radar } from 'lucide-react';

type TournamentComingSoonCardProps = {
  className?: string;
  delay?: number;
  subtitle?: string;
};

export function TournamentComingSoonCard({
  className = '',
  delay = 0,
  subtitle = 'New Warzone brackets are being prepared. Check back for the next deployment wave.',
}: TournamentComingSoonCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay }}
      whileHover={{ y: -6 }}
      className={`group h-full ${className}`}
    >
      <div
        className="relative h-full flex flex-col rounded-2xl overflow-hidden border border-dashed border-gold/30 bg-gradient-to-br from-[#1c1508] via-[#12100a] to-[#0e0b06]"
        style={{ boxShadow: '0 0 32px rgba(255, 215, 60, 0.06)' }}
      >
        <div
          className="absolute top-0 left-0 right-0 h-[3px]"
          style={{
            background: 'repeating-linear-gradient(-45deg,#e8a317,#e8a317 5px,#0d0a06 5px,#0d0a06 10px)',
          }}
        />

        <div className="relative flex-1 min-h-[11rem] sm:min-h-[12.5rem] flex flex-col items-center justify-center px-6 py-10 overflow-hidden">
          <div
            className="absolute inset-0 opacity-30 pointer-events-none"
            style={{
              backgroundImage:
                'linear-gradient(rgba(255,198,71,0.06) 1px,transparent 1px),linear-gradient(90deg,rgba(255,198,71,0.06) 1px,transparent 1px)',
              backgroundSize: '24px 24px',
            }}
          />
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 18, repeat: Infinity, ease: 'linear' }}
            className="absolute w-40 h-40 rounded-full border border-gold/10"
          />
          <motion.div
            animate={{ scale: [1, 1.08, 1], opacity: [0.5, 0.85, 0.5] }}
            transition={{ duration: 2.5, repeat: Infinity }}
            className="relative mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-gold/25 bg-gold/10"
          >
            <Radar className="w-7 h-7 text-gold" />
          </motion.div>
          <p className="font-russo text-[10px] tracking-[0.4em] text-gold/70 uppercase mb-2 relative z-10">
            Deploying Soon
          </p>
          <h3 className="font-orbitron text-lg sm:text-xl font-black text-foreground text-center relative z-10">
            NEW TOURNAMENTS
          </h3>
          <p className="font-rajdhani text-xs sm:text-sm text-muted-foreground text-center max-w-[16rem] mt-2 relative z-10 leading-relaxed">
            {subtitle}
          </p>
        </div>

        <div className="px-4 sm:px-5 py-4 border-t border-gold/15 bg-black/20">
          <div className="flex items-center justify-between">
            <span className="font-russo text-[10px] tracking-[0.3em] text-gold/50 uppercase">
              Intel incoming
            </span>
            <div className="flex h-7 w-7 items-center justify-center rounded-full border border-gold/20 bg-gold/5">
              <Crosshair className="w-3.5 h-3.5 text-gold/50" />
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

export default TournamentComingSoonCard;
