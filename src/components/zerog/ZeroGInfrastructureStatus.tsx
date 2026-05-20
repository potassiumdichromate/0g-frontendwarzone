import type { LucideIcon } from 'lucide-react';
import { motion } from 'framer-motion';
import { ShieldCheck, UserCircle, Lock, Box } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { getNetworkStatus } from '@/api/zerog';
import zgLogo from '@/assets/0G-white-logo.png';

type InfraItemProps = {
  icon: LucideIcon;
  title: string;
  sub: React.ReactNode;
};

function InfraItem({ icon: Icon, title, sub }: InfraItemProps) {
  return (
    <div className="flex flex-col items-center text-center gap-2.5 sm:gap-3 group">
      <div className="h-12 w-12 sm:h-14 sm:w-14 rounded-xl grid place-items-center border border-gold/20 bg-gold/10 text-gold transition-colors group-hover:border-gold/35 group-hover:bg-gold/15 shadow-[0_0_20px_rgba(255,215,60,0.08)]">
        <Icon className="w-5 h-5 sm:w-6 sm:h-6" strokeWidth={1.75} />
      </div>
      <div className="font-orbitron text-[10px] sm:text-xs font-bold tracking-wider text-foreground uppercase">
        {title}
      </div>
      <div className="font-rajdhani text-[10px] sm:text-xs text-gold/60 flex items-center justify-center gap-1">
        {sub}
      </div>
    </div>
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
      <div
        className="relative rounded-2xl sm:rounded-3xl border border-gold/25 overflow-hidden bg-gradient-to-br from-[#1c1508] to-[#0e0b06]"
        style={{ boxShadow: '0 0 40px rgba(255, 215, 60, 0.06)' }}
      >
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-gold/40 to-transparent" />

        {/* Subtle speckle texture */}
        <div
          className="absolute inset-0 pointer-events-none opacity-50"
          style={{
            backgroundImage: `
              radial-gradient(1px 1px at 20% 30%, rgba(255,215,60,0.15) 50%, transparent 100%),
              radial-gradient(1px 1px at 60% 70%, rgba(255,255,255,0.12) 50%, transparent 100%),
              radial-gradient(1px 1px at 80% 20%, rgba(255,255,255,0.08) 50%, transparent 100%),
              radial-gradient(1.5px 1.5px at 40% 80%, rgba(255,198,71,0.2) 50%, transparent 100%),
              radial-gradient(1px 1px at 90% 50%, rgba(255,255,255,0.1) 50%, transparent 100%)
            `,
            backgroundSize: '100% 100%',
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-gold/[0.03] via-transparent to-transparent pointer-events-none" />

        <div className="relative z-10 px-5 py-6 sm:px-8 sm:py-8">
          <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3 mb-6 sm:mb-8">
            <img src={zgLogo} alt="0G" className="h-4 sm:h-5 w-auto opacity-90" />
            <div className="font-russo text-[10px] sm:text-xs tracking-[0.35em] text-gold/80 uppercase">
              Infrastructure Status
            </div>
            {network && (
              <span
                className={`ml-1 inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full font-russo text-[8px] tracking-widest uppercase border ${
                  networkOk
                    ? 'border-gold/25 bg-gold/5 text-gold/90'
                    : 'border-primary/30 bg-primary/10 text-primary'
                }`}
              >
                {networkOk && (
                  <span
                    className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse shrink-0"
                    style={{ boxShadow: '0 0 6px hsl(120, 80%, 45%, 0.8)' }}
                  />
                )}
                {networkOk ? 'Live' : String(network.overall)}
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 sm:gap-4 md:gap-6">
            <InfraItem icon={ShieldCheck} title="Verified" sub={daSub} />
            <InfraItem
              icon={UserCircle}
              title="Identity"
              sub={
                <>
                  <img src={zgLogo} alt="" className="h-2.5 sm:h-3 w-auto opacity-80" aria-hidden />
                  Native
                </>
              }
            />
            <InfraItem icon={Lock} title="Secured" sub="On-Chain" />
            <InfraItem icon={Box} title="Storage" sub="Decentralized" />
          </div>

          <div className="mt-6 sm:mt-8 text-center">
            <Link
              to="/og-dashboard"
              className="font-russo text-[10px] sm:text-xs tracking-widest text-gold/70 hover:text-gold transition-colors uppercase"
            >
              Open 0G Dashboard →
            </Link>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

export default ZeroGInfrastructureStatus;
