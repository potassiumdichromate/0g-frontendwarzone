import type { LucideIcon } from 'lucide-react';
import { motion } from 'framer-motion';
import { ShieldCheck, UserCircle, Lock, Box } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { getNetworkStatus } from '@/api/zerog';
import zgLogo from '@/assets/0G-white-logo.png';

type InfraCardProps = {
  icon: LucideIcon;
  title: string;
  sub: React.ReactNode;
  badge?: React.ReactNode;
  delay?: number;
  accent?: 'gold' | 'green' | 'blue' | 'purple';
};

const ACCENT_STYLES = {
  gold: {
    border: 'border-gold/30',
    iconBg: 'bg-gold/10 border-gold/25',
    iconColor: 'text-gold',
    glow: '0 0 40px rgba(255,215,60,0.1)',
    badgeBorder: 'border-gold/25 bg-gold/8 text-gold/90',
    subColor: 'text-gold/70',
    topLine: 'via-gold/50',
  },
  green: {
    border: 'border-green-500/30',
    iconBg: 'bg-green-500/10 border-green-500/25',
    iconColor: 'text-green-400',
    glow: '0 0 40px rgba(34,197,94,0.08)',
    badgeBorder: 'border-green-500/25 bg-green-500/8 text-green-400/90',
    subColor: 'text-green-400/70',
    topLine: 'via-green-500/40',
  },
  blue: {
    border: 'border-blue-400/30',
    iconBg: 'bg-blue-400/10 border-blue-400/25',
    iconColor: 'text-blue-300',
    glow: '0 0 40px rgba(96,165,250,0.08)',
    badgeBorder: 'border-blue-400/25 bg-blue-400/8 text-blue-300/90',
    subColor: 'text-blue-300/70',
    topLine: 'via-blue-400/40',
  },
  purple: {
    border: 'border-purple-400/30',
    iconBg: 'bg-purple-400/10 border-purple-400/25',
    iconColor: 'text-purple-300',
    glow: '0 0 40px rgba(192,132,252,0.08)',
    badgeBorder: 'border-purple-400/25 bg-purple-400/8 text-purple-300/90',
    subColor: 'text-purple-300/70',
    topLine: 'via-purple-400/40',
  },
};

function InfraCard({ icon: Icon, title, sub, badge, delay = 0, accent = 'gold' }: InfraCardProps) {
  const s = ACCENT_STYLES[accent];
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.45, delay }}
      whileHover={{ y: -4, scale: 1.02 }}
      className={`relative rounded-2xl border ${s.border} overflow-hidden bg-gradient-to-br from-[#1c1508] to-[#0e0b06] flex flex-col items-center text-center p-6 sm:p-8 gap-4 group cursor-default`}
      style={{ boxShadow: s.glow }}
    >
      <div className={`absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent ${s.topLine} to-transparent`} />
      <div className="absolute inset-0 bg-gradient-to-b from-white/[0.02] via-transparent to-transparent pointer-events-none" />

      <div
        className={`relative z-10 h-16 w-16 sm:h-20 sm:w-20 rounded-2xl grid place-items-center border ${s.iconBg} ${s.iconColor} transition-all group-hover:scale-110`}
        style={{ boxShadow: `0 0 24px ${accent === 'gold' ? 'rgba(255,215,60,0.15)' : accent === 'green' ? 'rgba(34,197,94,0.12)' : accent === 'blue' ? 'rgba(96,165,250,0.12)' : 'rgba(192,132,252,0.12)'}` }}
      >
        <Icon className="w-8 h-8 sm:w-9 sm:h-9" strokeWidth={1.5} />
      </div>

      <div className="relative z-10 flex flex-col items-center gap-2">
        <div className="font-orbitron text-base sm:text-lg md:text-xl font-black tracking-wider text-foreground uppercase">
          {title}
        </div>
        {badge && <div className="inline-flex">{badge}</div>}
        <div className={`font-rajdhani text-sm sm:text-base ${s.subColor} flex items-center justify-center gap-1.5 font-semibold`}>
          {sub}
        </div>
      </div>
    </motion.div>
  );
}

type ZeroGInfrastructureStatusProps = {
  className?: string;
};

export function ZeroGInfrastructureStatus({ className = '' }: ZeroGInfrastructureStatusProps) {
  const { data: network } = useQuery({
    queryKey: ['zg-network-infra'],
    queryFn: getNetworkStatus,
    staleTime: 60_000,
    retry: 1,
  });

  const networkOk = network?.overall === 'healthy' || network?.overall === 'ok';
  const daSub = networkOk ? 'DA Verified' : network ? 'Syncing…' : 'DA Verified';

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.45 }}
      className={className}
    >
      {/* Header */}
      <div className="flex flex-col items-center gap-3 mb-8 sm:mb-10">
        <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4">
          <img src={zgLogo} alt="0G" className="h-8 sm:h-10 md:h-12 w-auto opacity-95" />
          <div className="font-russo text-xl sm:text-2xl md:text-3xl tracking-[0.2em] text-gold/90 uppercase">
            Infrastructure Status
          </div>
          {network && (
            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full font-russo text-[9px] tracking-widest uppercase border ${
                networkOk
                  ? 'border-gold/25 bg-gold/8 text-gold/90'
                  : 'border-primary/30 bg-primary/10 text-primary'
              }`}
            >
              {networkOk && (
                <span
                  className="w-2 h-2 rounded-full bg-green-400 animate-pulse shrink-0"
                  style={{ boxShadow: '0 0 8px hsl(120, 80%, 45%, 0.9)' }}
                />
              )}
              {networkOk ? 'Live' : String(network.overall)}
            </span>
          )}
        </div>
      </div>

      {/* 4 Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 md:gap-5">
        <InfraCard
          icon={ShieldCheck}
          title="Verified"
          sub={daSub}
          accent="gold"
          delay={0}
          badge={
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full font-russo text-[8px] tracking-widest uppercase border border-gold/25 bg-gold/8 text-gold/80">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" style={{ boxShadow: '0 0 6px rgba(74,222,128,0.8)' }} />
              Active
            </span>
          }
        />
        <InfraCard
          icon={UserCircle}
          title="Identity"
          sub={
            <span className="flex items-center gap-1.5">
              <img src={zgLogo} alt="" className="h-3.5 sm:h-4 w-auto opacity-80" aria-hidden />
              Native
            </span>
          }
          accent="blue"
          delay={0.08}
          badge={
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full font-russo text-[8px] tracking-widest uppercase border border-blue-400/25 bg-blue-400/8 text-blue-300/80">
              On-Chain
            </span>
          }
        />
        <InfraCard
          icon={Lock}
          title="Secured"
          sub="On-Chain"
          accent="purple"
          delay={0.16}
          badge={
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full font-russo text-[8px] tracking-widest uppercase border border-purple-400/25 bg-purple-400/8 text-purple-300/80">
              Protected
            </span>
          }
        />
        <InfraCard
          icon={Box}
          title="Storage"
          sub="Decentralized"
          accent="green"
          delay={0.24}
          badge={
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full font-russo text-[8px] tracking-widest uppercase border border-green-500/25 bg-green-500/8 text-green-400/80">
              Distributed
            </span>
          }
        />
      </div>
    </motion.div>
  );
}

export default ZeroGInfrastructureStatus;
