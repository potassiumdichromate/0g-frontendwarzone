import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ShoppingCart, ArrowLeft, Sparkles, ChevronLeft, ChevronRight,
  Home, Zap, Lock, Crown, Star, Wallet, Copy, Check, RefreshCw, X,
} from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import { createPublicClient, http, formatEther } from "viem";
import { GameButton } from "@/components/ui/game-button";
import { MetalCard } from "@/components/ui/metal-card";
import PageWalletControls from "@/components/PageWalletControls";
import { usePrivyWalletTools } from "@/hooks/usePrivyWalletTools";

import marketplaceCoins from "@/assets/images/marketplace-coins-new.png";
import marketplaceGuns from "@/assets/images/marketplace-guns.png";

import gemsSmall from "@/assets/images/gems-small.png";
import gemsChest from "@/assets/images/gems-chest.png";
import soldierCard from "@/assets/soldier-card-1-clean.png";

import decoLamp from "@/assets/images/deco-lamp.png";
import decoChain from "@/assets/images/deco-chain.png";
import decoRubble from "@/assets/images/deco-rubble.png";

export type IapMarketCategory = "warriors" | "coins" | "gems" | "guns";

export type IapMarketDisplayItem = {
  id: number;
  name: string;
  amountLabel: string;
  priceNumeric: string;
  popular?: boolean;
  bonus?: string;
  image: string;
  detailImage: string;
  rarity: string;
  iapType: "Warriors" | "Coins" | "Gems" | "Guns";
  iapValue: string;
  owned?: boolean;
};

type CategoryStyle = {
  accent: string;
  glow: string;
  soft: string;
  border: string;
  panel: string;
  button: string;
  icon: string;
};

const CATEGORY_STYLE: Record<IapMarketCategory, CategoryStyle> = {
  warriors: {
    accent: "#ffc447",
    glow: "#ffd66f",
    soft: "rgba(255, 196, 71, 0.18)",
    border: "rgba(255, 196, 71, 0.4)",
    panel: "linear-gradient(145deg, rgba(62, 38, 15, 0.92) 0%, rgba(20, 12, 7, 0.96) 100%)",
    button: "linear-gradient(180deg, #ffd66f 0%, #c78322 100%)",
    icon: "⚔",
  },
  coins: {
    accent: "#d9a441",
    glow: "#f6c86a",
    soft: "rgba(217, 164, 65, 0.18)",
    border: "rgba(217, 164, 65, 0.4)",
    panel: "linear-gradient(145deg, rgba(68, 46, 18, 0.92) 0%, rgba(26, 17, 8, 0.96) 100%)",
    button: "linear-gradient(180deg, #f0bf63 0%, #b87923 100%)",
    icon: "🪙",
  },
  gems: {
    accent: "#00bcd4",
    glow: "#4dd0e1",
    soft: "rgba(0, 188, 212, 0.18)",
    border: "rgba(77, 208, 225, 0.38)",
    panel: "linear-gradient(145deg, rgba(10, 36, 48, 0.92) 0%, rgba(6, 18, 26, 0.96) 100%)",
    button: "linear-gradient(180deg, #4dd0e1 0%, #00838f 100%)",
    icon: "💎",
  },
  guns: {
    accent: "#d06a2f",
    glow: "#ff9f57",
    soft: "rgba(208, 106, 47, 0.18)",
    border: "rgba(255, 159, 87, 0.38)",
    panel: "linear-gradient(145deg, rgba(59, 30, 16, 0.92) 0%, rgba(22, 12, 8, 0.96) 100%)",
    button: "linear-gradient(180deg, #f58d52 0%, #a8471a 100%)",
    icon: "🔫",
  },
};

const rarityColors: Record<string, { text: string; bg: string; border: string }> = {
  COMMON:    { text: "#9ca3af", bg: "#9ca3af20", border: "#9ca3af40" },
  UNCOMMON:  { text: "#4ade80", bg: "#4ade8020", border: "#4ade8040" },
  RARE:      { text: "#60a5fa", bg: "#60a5fa20", border: "#60a5fa40" },
  EPIC:      { text: "#a855f7", bg: "#a855f720", border: "#a855f740" },
  LEGENDARY: { text: "#ffd700", bg: "#ffd70020", border: "#ffd70050" },
  MYTHIC:    { text: "#ff6a00", bg: "#ff6a0020", border: "#ff6a0050" },
};

const categoryImages: Record<IapMarketCategory, string> = {
  warriors: soldierCard,
  coins: marketplaceCoins,
  gems: gemsChest,
  guns: marketplaceGuns,
};

const ITEMS_PER_PAGE = 6;
const MARQUEE_ITEMS = ["WARRIORS", "COINS", "GEMS", "WEAPONS", "GEAR UP", "UPGRADE", "DOMINATE", "BATTLE"];

export type IapMarketplaceLayoutProps = {
  itemsByCategory: Record<IapMarketCategory, IapMarketDisplayItem[]>;
  onSelectItem: (item: IapMarketDisplayItem) => void;
  onRequestLogin: () => void;
  isConnected: boolean;
  address: string | null;
  onDisconnect: () => void | Promise<void>;
};

const IapMarketplaceLayout = ({
  itemsByCategory,
  onSelectItem,
  onRequestLogin,
  isConnected,
  address,
  onDisconnect,
}: IapMarketplaceLayoutProps) => {
  const [searchParams] = useSearchParams();
  const [activeCategory, setActiveCategory] = useState<IapMarketCategory>("warriors");

  // ── My Funds modal ──
  const { canUsePrivy, activeWallet, allowedChain, openPrivyFunding } = usePrivyWalletTools();
  const [fundsOpen, setFundsOpen] = useState(false);
  const [balance, setBalance] = useState<string | null>(null);
  const [balanceLoading, setBalanceLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const balanceTick = useRef(0);

  useEffect(() => {
    if (!canUsePrivy || !activeWallet?.address || !allowedChain?.decimalChainId) {
      setBalance(null);
      return;
    }
    let cancelled = false;
    const tick = ++balanceTick.current;
    const load = async () => {
      setBalanceLoading(true);
      try {
        const rpcUrl =
          (Array.isArray(allowedChain.rpcUrls) && allowedChain.rpcUrls[0]) ||
          'https://evmrpc.0g.ai';
        const chain = {
          id: allowedChain.decimalChainId,
          name: allowedChain.chainName || '0G Mainnet',
          nativeCurrency: { name: '0G', symbol: '0G', decimals: 18, ...allowedChain.nativeCurrency },
          rpcUrls: { default: { http: [rpcUrl] }, public: { http: [rpcUrl] } },
        };
        const client = createPublicClient({ chain, transport: http(rpcUrl) });
        const raw = await client.getBalance({ address: activeWallet.address });
        if (!cancelled && tick === balanceTick.current) {
          setBalance(Number(formatEther(raw)).toLocaleString(undefined, { maximumFractionDigits: 4 }));
        }
      } catch {
        if (!cancelled) setBalance(null);
      } finally {
        if (!cancelled) setBalanceLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [canUsePrivy, activeWallet, allowedChain, fundsOpen]);

  const handleCopyAddress = async () => {
    if (!activeWallet?.address) return;
    try {
      await navigator.clipboard.writeText(activeWallet.address);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* ignore */ }
  };

  const handleAddFunds = async () => {
    try { await openPrivyFunding(); } catch { /* ignore */ }
  };

  const showFundsButton = canUsePrivy && !!activeWallet?.address;
  const symbol = allowedChain?.nativeCurrency?.symbol || '0G';
  const shortAddress = activeWallet?.address
    ? `${activeWallet.address.slice(0, 6)}...${activeWallet.address.slice(-4)}`
    : '';

  useEffect(() => {
    const cat = searchParams.get("category") as IapMarketCategory;
    if (cat && ["warriors", "coins", "gems", "guns"].includes(cat)) setActiveCategory(cat);
  }, [searchParams]);

  const [currentPage, setCurrentPage] = useState(1);

  const items = itemsByCategory[activeCategory];
  const isGunCategory = activeCategory === "guns";
  const isWarriorCategory = activeCategory === "warriors";
  const { accent, glow, soft, border, panel, button } = CATEGORY_STYLE[activeCategory];
  const totalPages = Math.max(1, Math.ceil(items.length / ITEMS_PER_PAGE));
  const currentItems = items.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  useEffect(() => {
    setCurrentPage(1);
  }, [activeCategory]);

  const categories: { id: IapMarketCategory; label: string; image: string; desc: string }[] = [
    { id: "warriors", label: "WARRIORS", image: soldierCard, desc: "Characters" },
    { id: "coins", label: "COINS", image: marketplaceCoins, desc: "Currency" },
    { id: "gems", label: "GEMS", image: gemsSmall, desc: "Premium" },
    { id: "guns", label: "ARSENAL", image: marketplaceGuns, desc: "Weapons" },
  ];

  const formatPrice = (item?: IapMarketDisplayItem) => {
    if (!item) return "—";
    if (item.iapType === "Warriors") {
      return item.priceNumeric === "FREE" ? "FREE" : `${item.priceNumeric} 0G`;
    }
    return `${item.priceNumeric} 0G`;
  };

  const handleBuyNow = (item: IapMarketDisplayItem) => {
    if (item.iapType === "Warriors") return;
    if (item.owned) return;
    if (!isConnected) {
      onRequestLogin();
      return;
    }
    onSelectItem(item);
  };

  return (
    <div className="min-h-screen bg-background relative overflow-x-hidden pb-36 sm:pb-0">

      {/* ── Video background ── */}
      <div className="fixed inset-0 z-0">
        <video autoPlay muted loop playsInline className="w-full h-full object-cover opacity-30">
          <source src="/videos/war-scene.mp4" type="video/mp4" />
        </video>
        <div className="absolute inset-0 bg-background/70" />
        <div className="absolute inset-0 bg-gradient-to-b from-background/50 via-background/60 to-background/95" />
      </div>

      {/* ── Header ── */}
      <header className="fixed top-0 left-0 right-0 z-50">
        <div className="bg-background/95 backdrop-blur-md border-b border-border">
          <div className="container mx-auto px-4 relative flex items-center justify-between h-14 sm:h-16">
            <Link to="/" className="relative z-10 shrink-0">
              <motion.div
                whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-card/50 border border-border hover:border-gold transition-all group"
              >
                <ArrowLeft className="w-4 h-4 text-muted-foreground group-hover:text-gold transition-colors" />
                <Home       className="w-4 h-4 text-muted-foreground group-hover:text-gold transition-colors" />
                <span className="font-russo text-xs text-muted-foreground group-hover:text-gold transition-colors hidden sm:block">HOME</span>
              </motion.div>
            </Link>
            <div className="pointer-events-none absolute left-1/2 top-1/2 z-0 flex max-w-[calc(100%-120px)] -translate-x-1/2 -translate-y-1/2 items-center justify-center gap-2 px-2 text-center sm:max-w-none">
              <ShoppingCart className="w-4 h-4 sm:w-6 sm:h-6 shrink-0 text-gold animate-pulse-glow" />
              <h1 className="font-orbitron text-sm sm:text-lg md:text-xl font-bold leading-none text-gradient-sunset whitespace-nowrap">MARKETPLACE</h1>
            </div>
            <div className="relative z-10 hidden sm:flex items-center gap-2">
              {showFundsButton && (
                <motion.button
                  type="button"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setFundsOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gold/10 border border-gold/40 hover:border-gold hover:bg-gold/20 transition-all"
                >
                  <Wallet className="w-3.5 h-3.5 text-gold" />
                  <span className="font-russo text-xs text-gold hidden sm:block">MY FUNDS</span>
                </motion.button>
              )}
              <PageWalletControls
                isConnected={isConnected}
                address={address}
                onDisconnect={onDisconnect}
                onRequestLogin={onRequestLogin}
              />
            </div>
          </div>
          <div className="h-[2px]" style={{ background: "linear-gradient(90deg, transparent, hsl(42,100%,50%) 30%, hsl(42,100%,50%) 70%, transparent)" }} />
        </div>
      </header>

      {/* ── Main ── */}
      <div className="relative z-10 pt-14 sm:pt-16">

        {/* Marquee */}
        <div className="hazard-stripe-sm h-3" />
        <div className="overflow-hidden py-3 border-b border-gold/20" style={{ background: "linear-gradient(90deg, hsl(20,35%,6%) 0%, hsl(20,30%,10%) 50%, hsl(20,35%,6%) 100%)" }}>
          <div className="flex animate-marquee whitespace-nowrap">
            {[...MARQUEE_ITEMS, ...MARQUEE_ITEMS].map((item, i) => (
              <span key={i} className="flex items-center mx-6 sm:mx-10">
                <Star className="w-3 h-3 text-gold mr-2" fill="hsl(42,100%,50%)" />
                <span className="font-orbitron text-sm sm:text-base font-black text-foreground tracking-wider">{item}</span>
              </span>
            ))}
          </div>
        </div>

        <section className="relative overflow-hidden">

          <div className="scan-line" />
          <motion.img src={decoLamp} alt="" className="absolute right-2 top-4 w-10 sm:w-14 z-[1] opacity-40 pointer-events-none"
            animate={{ filter: ["drop-shadow(0 0 12px hsl(28,100%,50%,0.5))","drop-shadow(0 0 24px hsl(28,100%,50%,0.8))","drop-shadow(0 0 12px hsl(28,100%,50%,0.5))"] }}
            transition={{ duration: 3, repeat: Infinity }} loading="lazy"
          />
          <img src={decoChain} alt="" className="absolute left-2 top-1/4 w-5 z-[1] hidden xl:block opacity-20 pointer-events-none" loading="lazy" />

          <div className="container mx-auto px-4 relative z-10">

            {/* ── TOP: LEFT text + tabs | RIGHT showcase ── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-10 pt-6 sm:pt-8 pb-6 items-center">

              {/* LEFT column — vertical category selector panel */}
              <motion.div
                initial={{ opacity: 0, x: -24 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5 }}
                className="flex flex-col gap-3"
              >
                {/* Panel heading */}
                <div className="flex items-center gap-3 mb-1">
                  <div className="hazard-stripe-sm w-1 h-5 rounded" />
                  <span className="font-pixel text-[9px] sm:text-[10px] tracking-widest text-gold">SELECT CATEGORY</span>
                  <div className="flex-1 h-px bg-gold/20" />
                  <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-accent/20 border border-accent/30">
                    <div className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
                    <span className="font-russo text-[9px] text-accent">LIVE</span>
                  </div>
                </div>

                {/* Vertical stacked selector buttons */}
                {categories.map((cat, i) => {
                  const catTheme = CATEGORY_STYLE[cat.id];
                  const isActive = activeCategory === cat.id;
                  return (
                    <motion.button
                      key={cat.id}
                      onClick={() => { setActiveCategory(cat.id); setCurrentPage(1); }}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.08 }}
                      whileHover={{ x: 4, scale: 1.01 }}
                      whileTap={{ scale: 0.98 }}
                      className="relative w-full flex items-center gap-4 px-4 py-3.5 sm:py-4 rounded-2xl overflow-hidden transition-all text-left"
                      style={{
                        background: isActive
                          ? catTheme.panel
                          : "linear-gradient(180deg, rgba(35, 23, 16, 0.92) 0%, rgba(16, 11, 9, 0.96) 100%)",
                        border: `1px solid ${isActive ? catTheme.border : "hsl(25 25% 18%)"}`,
                        boxShadow: isActive
                          ? `0 12px 30px rgba(0, 0, 0, 0.38), inset 0 1px 0 ${catTheme.soft}, 0 0 0 1px ${catTheme.soft}`
                          : "0 10px 24px rgba(0, 0, 0, 0.28)",
                      }}
                    >
                      {/* Shimmer sweep on active */}
                      {isActive && (
                        <motion.div
                          className="absolute inset-0 pointer-events-none"
                          style={{ background: `linear-gradient(105deg, transparent 30%, ${catTheme.soft} 50%, transparent 70%)` }}
                          animate={{ x: ["-100%", "200%"] }}
                          transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut", repeatDelay: 1 }}
                        />
                      )}

                      {/* Active left accent bar */}
                      {isActive && (
                        <div
                          className="absolute left-0 top-3 bottom-3 w-1 rounded-r-full"
                          style={{ background: catTheme.accent, boxShadow: `0 0 8px ${catTheme.glow}` }}
                        />
                      )}

                      {/* Icon */}
                      <div
                        className="relative shrink-0 w-14 h-14 sm:w-16 sm:h-16 rounded-xl flex items-center justify-center overflow-hidden"
                        style={{
                          background: isActive ? catTheme.soft : "hsl(20 25% 13%)",
                          border: `1px solid ${isActive ? catTheme.border : "hsl(25 25% 20%)"}`,
                        }}
                      >
                        <motion.img
                          src={cat.image}
                          alt={cat.label}
                          className="w-10 h-10 sm:w-12 sm:h-12 object-contain"
                          loading="lazy"
                          animate={isActive ? { y: [0, -4, 0] } : { y: 0 }}
                          transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
                          style={{ filter: isActive ? `drop-shadow(0 0 8px ${catTheme.glow})` : undefined }}
                        />
                      </div>

                      {/* Label + desc */}
                      <div className="flex-1 relative z-10">
                        <div
                          className="font-russo text-sm sm:text-base tracking-wider leading-none mb-1"
                          style={{ color: isActive ? catTheme.glow : "hsl(38 40% 80%)" }}
                        >
                          {cat.label}
                        </div>
                        <div className="font-rajdhani text-xs sm:text-sm text-muted-foreground">{cat.desc}</div>
                        {isActive && (
                          <div className="flex items-center gap-1.5 mt-1.5">
                            <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: catTheme.glow }} />
                            <span className="font-russo text-[9px] tracking-widest" style={{ color: catTheme.glow }}>SELECTED</span>
                          </div>
                        )}
                      </div>

                      {/* Arrow indicator */}
                      <ChevronRight
                        className="w-4 h-4 shrink-0 transition-all relative z-10"
                        style={{ color: isActive ? catTheme.glow : "hsl(25 25% 30%)", opacity: isActive ? 1 : 0.4 }}
                      />
                    </motion.button>
                  );
                })}

                {!isConnected && (
                  <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-destructive/10 border border-destructive/30 mt-1">
                    <Lock className="w-3.5 h-3.5 text-destructive shrink-0" />
                    <span className="font-rajdhani text-xs text-destructive">Connect wallet to purchase</span>
                  </div>
                )}
              </motion.div>

              {/* RIGHT column — category showcase */}
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeCategory}
                  initial={{ opacity: 0, x: 24, scale: 0.9 }}
                  animate={{ opacity: 1, x: 0, scale: 1 }}
                  exit={{ opacity: 0, x: -24, scale: 0.9 }}
                  transition={{ type: "spring", stiffness: 160, damping: 18 }}
                  className="flex flex-col items-center justify-center py-2"
                >
                  {/* Showcase box */}
                  <div
                    className="relative flex flex-col items-center justify-center w-full max-w-md mx-auto rounded-[28px] py-6 px-5 overflow-hidden"
                    style={{
                      background: panel,
                      border: `1px solid ${border}`,
                      boxShadow: `0 16px 40px rgba(0, 0, 0, 0.4), inset 0 1px 0 ${soft}`,
                    }}
                  >
                    {/* Inner glow */}
                    <motion.div
                      className="absolute inset-0 rounded-2xl"
                      animate={{ opacity: [0.04, 0.14, 0.04] }}
                      transition={{ duration: 3, repeat: Infinity }}
                      style={{ background: `radial-gradient(ellipse at 50% 50%, ${soft} 0%, transparent 70%)` }}
                    />

                    {/* Aura blob */}
                    <div className="absolute w-28 h-28 rounded-full blur-2xl animate-aura" style={{ background: glow, opacity: 0.18 }} />

                    {!isGunCategory && !isWarriorCategory && (
                      <div className="absolute inset-x-5 top-5 h-24 rounded-2xl border border-white/5 bg-background/25" />
                    )}

                    {/* Main image */}
                    <motion.img
                      src={categoryImages[activeCategory]}
                      alt={activeCategory}
                      className={`relative z-10 object-contain mt-3 ${isWarriorCategory ? "w-36 h-36 sm:w-48 sm:h-48 lg:w-56 lg:h-56" : "w-28 h-28 sm:w-36 sm:h-36 lg:w-44 lg:h-44"}`}
                      loading="lazy"
                      animate={{ y: [0, -10, 0] }}
                      transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                      style={{ filter: `drop-shadow(0 16px 32px ${soft})` }}
                    />

                    {/* Category name below image */}
                    <h3
                      className="relative z-10 font-orbitron text-xl sm:text-2xl font-black mt-3"
                      style={{ color: glow }}
                    >
                      {isWarriorCategory ? "HANDSOME MAN" : activeCategory.toUpperCase()}
                    </h3>
                    <p className="relative z-10 font-rajdhani text-xs text-muted-foreground tracking-widest mt-0.5">
                      {categories.find(c => c.id === activeCategory)?.desc}
                    </p>

                    <div className="relative z-10 mt-5 grid grid-cols-2 gap-3 w-full">
                      <div className="rounded-2xl border border-white/8 bg-background/20 px-3 py-3">
                        <div className="font-russo text-[10px] tracking-widest text-muted-foreground mb-1">BEST VALUE</div>
                        <div className="font-orbitron text-sm font-black" style={{ color: glow }}>
                          {items.find((item) => item.popular)?.name || items[0]?.name}
                        </div>
                      </div>
                      <div className="rounded-2xl border border-white/8 bg-background/20 px-3 py-3">
                        <div className="font-russo text-[10px] tracking-widest text-muted-foreground mb-1">PRICE RANGE</div>
                        <div className="font-orbitron text-sm font-black text-foreground">
                          {isWarriorCategory
                            ? `${formatPrice(items[0])} - ${formatPrice(items[items.length - 1])}`
                            : `${items[0]?.priceNumeric} - ${items[items.length - 1]?.priceNumeric} 0G`}
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>

            {/* ── Divider before items ── */}
            <div className="hazard-stripe-sm h-[3px] rounded mb-6" />

            {/* ── BOTTOM: Items grid ── */}
            <AnimatePresence mode="wait">
              <motion.div
                key={`${activeCategory}-${currentPage}`}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.25 }}
                className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-5"
              >
                {currentItems.map((item, index) => {
                  const rarity = rarityColors[item.rarity ?? "COMMON"];
                  const showGunArtWithoutFrame = item.iapType === "Guns";
                  const isWarriorItem = item.iapType === "Warriors";
                  return (
                    <motion.div
                      key={item.id}
                      initial={{ opacity: 0, y: 24 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true }}
                      transition={{ delay: index * 0.07, type: "spring", stiffness: 160, damping: 18 }}
                      whileHover={item.owned ? {} : { y: -6, scale: 1.02 }}
                      whileTap={item.owned ? {} : { scale: 0.97 }}
                      className="h-full"
                    >
                      <MetalCard
                        className={`relative overflow-hidden h-full group card-shimmer ${item.popular ? "animate-popular-glow" : ""} ${item.owned ? "opacity-75 cursor-not-allowed" : "cursor-pointer"}`}
                        style={{
                          border: `1px solid ${item.popular ? border : "rgba(125, 93, 62, 0.32)"}`,
                          background: "linear-gradient(180deg, rgba(33, 22, 15, 0.98) 0%, rgba(15, 10, 8, 0.98) 100%)",
                          boxShadow: item.popular
                            ? `0 16px 40px rgba(0, 0, 0, 0.42), 0 0 0 1px ${soft}`
                            : "0 14px 36px rgba(0, 0, 0, 0.34)",
                        }}
                      >
                        {item.popular && (
                          <motion.div
                            className="absolute top-3 right-3 z-30 px-2 py-0.5 rounded-full text-[10px] font-russo text-background flex items-center gap-1"
                            style={{ background: button, color: "hsl(20 35% 6%)" }}
                            animate={{ scale: [1, 1.08, 1] }}
                            transition={{ duration: 1.8, repeat: Infinity }}
                          >
                            <Crown className="w-3 h-3" />
                            POPULAR
                          </motion.div>
                        )}

                        <div
                          className="absolute top-3 left-3 z-30 px-1.5 py-0.5 rounded text-[9px] font-russo tracking-widest"
                          style={{ background: rarity.bg, border: `1px solid ${rarity.border}`, color: rarity.text }}
                        >
                          {item.rarity}
                        </div>

                        {/* Image area */}
                        <div
                          className="relative flex justify-center items-center rounded-2xl mb-3 sm:mb-4 -mx-2 -mt-2 px-2 py-4 sm:py-8 overflow-hidden"
                          style={{
                            background: showGunArtWithoutFrame
                              ? "transparent"
                              : `radial-gradient(ellipse at 50% 60%, ${soft} 0%, rgba(18, 13, 10, 0.98) 60%), linear-gradient(180deg, rgba(18, 13, 10, 0.98) 0%, rgba(33, 22, 16, 0.94) 100%)`,
                            border: showGunArtWithoutFrame ? "1px solid transparent" : `1px solid ${border}`,
                            minHeight: "140px",
                          }}
                        >
                          {!showGunArtWithoutFrame && <div className="absolute inset-x-0 top-0 h-1 hazard-stripe-sm opacity-80" />}
                          {!showGunArtWithoutFrame && (
                            <div
                              className="absolute inset-x-6 bottom-4 h-14 rounded-full blur-3xl"
                              style={{ background: accent, opacity: 0.15 }}
                            />
                          )}
                          {!showGunArtWithoutFrame && (
                            <motion.div
                              className="absolute inset-0 rounded-xl"
                              animate={{ opacity: [0.04, 0.16, 0.04] }}
                              transition={{ duration: 2.5, repeat: Infinity }}
                              style={{ background: `radial-gradient(ellipse at 50% 55%, ${soft} 0%, transparent 72%)` }}
                            />
                          )}
                          <motion.img
                            src={item.image ?? categoryImages[activeCategory]}
                            alt={item.name}
                            className={`relative z-10 object-contain drop-shadow-2xl ${item.image ? "w-28 h-28 sm:w-40 sm:h-40" : "w-20 h-20 sm:w-32 sm:h-32"}`}
                            loading="lazy"
                            animate={{ y: [0, -8, 0], rotate: [0, 1, -1, 0] }}
                            transition={{ duration: 3 + index * 0.15, repeat: Infinity, ease: "easeInOut" }}
                            style={{ filter: `drop-shadow(0 12px 28px ${soft}) drop-shadow(0 0 12px ${soft})` }}
                          />
                          {!showGunArtWithoutFrame && (
                            <div className="absolute bottom-0 left-0 right-0 h-10 bg-gradient-to-t from-card/80 to-transparent rounded-b-xl" />
                          )}
                        </div>

                        {/* Info */}
                        <div className="text-center space-y-0.5 sm:space-y-1 px-1">
                          {!isWarriorItem && (
                            <h3 className="font-russo text-xs sm:text-base text-foreground">{item.name}</h3>
                          )}
                          <div className="font-orbitron text-base sm:text-2xl font-black" style={{ color: glow }}>{item.amountLabel}</div>
                          <p className="hidden sm:block font-rajdhani text-sm text-muted-foreground min-h-[20px]">
                            {activeCategory === "warriors"
                              ? "Character roster for battle deployment"
                              : activeCategory === "guns"
                                ? "Weapon unlock for combat loadouts"
                                : activeCategory === "gems"
                                  ? "Premium reserve for rare upgrades"
                                  : "Battle currency for gear and progression"}
                          </p>
                          {item.bonus && (
                            <motion.div
                              className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-russo text-background"
                              style={{ background: button, color: "hsl(20 35% 6%)" }}
                              animate={{ scale: [1, 1.05, 1] }}
                              transition={{ duration: 2, repeat: Infinity }}
                            >
                              <Sparkles className="w-2.5 h-2.5" />
                              {item.bonus}
                            </motion.div>
                          )}
                        </div>

                        {/* Price + CTA */}
                        <div className="mt-2 sm:mt-3 pt-2 sm:pt-3 border-t border-border px-1">
                          <div className="flex items-center justify-between mb-1.5 sm:mb-2.5">
                            <span className="hidden sm:block font-rajdhani text-xs text-muted-foreground">Price</span>
                            <div className="flex items-center gap-1 w-full sm:w-auto justify-center sm:justify-end">
                              <Zap className="w-3 h-3 text-gold" />
                              <span className="font-orbitron font-bold text-gold text-xs sm:text-lg">{formatPrice(item)}</span>
                            </div>
                          </div>
                          <div className="hidden sm:flex items-center justify-between mb-2 text-[10px] font-russo tracking-widest text-muted-foreground">
                            <span>INSTANT DELIVERY</span>
                            <span>{isWarriorItem ? "WALLET READY" : isConnected ? "WALLET READY" : "AUTH REQUIRED"}</span>
                          </div>
                          <motion.div whileHover={item.owned ? {} : { scale: 1.03 }} whileTap={item.owned ? {} : { scale: 0.97 }}>
                            <GameButton
                              variant={item.owned || isWarriorItem ? "metal" : isConnected ? "primary" : "metal"}
                              size="sm"
                              className="w-full"
                              disabled={item.owned || isWarriorItem}
                              onClick={() => handleBuyNow(item)}
                              style={
                                isConnected && !item.owned && !isWarriorItem
                                  ? { background: button, borderColor: border, color: "hsl(20 35% 6%)" }
                                  : undefined
                              }
                            >
                              {item.owned ? (
                                <>{isWarriorItem ? "FREE" : "OWNED"}</>
                              ) : isWarriorItem ? (
                                <>LOCKED</>
                              ) : isConnected ? (
                                <span className="whitespace-nowrap">BUY</span>
                              ) : (
                                <>
                                  <Lock className="w-3.5 h-3.5 mr-1.5" />
                                  <span className="sm:hidden">LOGIN</span>
                                  <span className="hidden sm:inline">LOGIN TO BUY</span>
                                </>
                              )}
                            </GameButton>
                          </motion.div>
                        </div>
                      </MetalCard>
                    </motion.div>
                  );
                })}
              </motion.div>
            </AnimatePresence>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 sm:gap-3 mt-8 pb-10">
                <motion.button
                  whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="p-2 sm:p-2.5 rounded-xl bg-card border border-border hover:border-primary disabled:opacity-40 transition-all"
                >
                  <ChevronLeft className="w-4 h-4 sm:w-5 sm:h-5" />
                </motion.button>
                {Array.from({ length: totalPages }).map((_, i) => (
                  <motion.button
                    key={i}
                    whileHover={{ scale: 1.2 }} whileTap={{ scale: 0.9 }}
                    onClick={() => setCurrentPage(i + 1)}
                    className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg font-russo text-sm transition-all"
                    style={{
                      background: currentPage === i + 1 ? button : undefined,
                      border: currentPage === i + 1 ? `1px solid ${border}` : "1px solid hsl(25 30% 20%)",
                      boxShadow: currentPage === i + 1 ? `0 0 14px ${soft}` : undefined,
                      color: currentPage === i + 1 ? "hsl(20 35% 6%)" : undefined,
                    }}
                  >
                    {i + 1}
                  </motion.button>
                ))}
                <motion.button
                  whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="p-2 sm:p-2.5 rounded-xl bg-card border border-border hover:border-primary disabled:opacity-40 transition-all"
                >
                  <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5" />
                </motion.button>
              </div>
            )}
          </div>

          <img src={decoRubble} alt="" className="absolute bottom-0 left-0 w-36 sm:w-52 z-[1] opacity-25 pointer-events-none" loading="lazy" />
          <img src={decoRubble} alt="" className="absolute bottom-0 right-0 w-28 sm:w-44 z-[1] opacity-15 pointer-events-none -scale-x-100" loading="lazy" />
        </section>
      </div>

      {/* ── My Funds modal ── */}
      <AnimatePresence>
        {fundsOpen && (
          <motion.div
            key="funds-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-center justify-center p-4"
            style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }}
            onClick={() => setFundsOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.92, y: -16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: -16 }}
              transition={{ type: "spring", stiffness: 260, damping: 22 }}
              className="relative w-full max-w-sm rounded-2xl overflow-hidden"
              style={{
                background: "linear-gradient(145deg, rgba(30,22,12,0.98) 0%, rgba(12,9,5,0.99) 100%)",
                border: "1px solid rgba(217,164,65,0.4)",
                boxShadow: "0 24px 60px rgba(0,0,0,0.7), 0 0 0 1px rgba(217,164,65,0.1)",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-gold/20">
                <div className="flex items-center gap-2">
                  <Wallet className="w-4 h-4 text-gold" />
                  <span className="font-orbitron text-sm font-bold text-gold">MY FUNDS</span>
                </div>
                <button
                  type="button"
                  onClick={() => setFundsOpen(false)}
                  className="p-1 rounded-lg hover:bg-white/10 transition-colors"
                >
                  <X className="w-4 h-4 text-muted-foreground" />
                </button>
              </div>

              {/* Body */}
              <div className="px-5 py-4 space-y-4">
                {/* Address row */}
                <div className="flex items-center justify-between gap-3">
                  <span className="font-russo text-xs text-muted-foreground tracking-widest">ADDRESS</span>
                  <button
                    type="button"
                    onClick={handleCopyAddress}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/5 border border-white/10 hover:border-gold/40 hover:bg-gold/10 transition-all"
                  >
                    <span className="font-orbitron text-xs text-foreground">{shortAddress}</span>
                    {copied
                      ? <Check className="w-3 h-3 text-green-400" />
                      : <Copy className="w-3 h-3 text-muted-foreground" />}
                  </button>
                </div>

                {/* Balance row */}
                <div className="flex items-center justify-between gap-3">
                  <span className="font-russo text-xs text-muted-foreground tracking-widest">BALANCE</span>
                  <div className="flex items-center gap-2">
                    <span className="font-orbitron text-base font-bold text-gold">
                      {balanceLoading ? '...' : balance != null ? `${balance} ${symbol}` : '—'}
                    </span>
                    <button
                      type="button"
                      onClick={() => { setFundsOpen(false); setTimeout(() => setFundsOpen(true), 0); }}
                      className="p-1 rounded hover:bg-white/10 transition-colors"
                      title="Refresh"
                    >
                      <RefreshCw className={`w-3 h-3 text-muted-foreground ${balanceLoading ? 'animate-spin' : ''}`} />
                    </button>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="px-5 pb-5">
                <motion.button
                  type="button"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={handleAddFunds}
                  className="w-full py-2.5 rounded-xl font-russo text-sm tracking-wider transition-all"
                  style={{
                    background: "linear-gradient(180deg, #f0bf63 0%, #b87923 100%)",
                    color: "hsl(20 35% 6%)",
                    boxShadow: "0 4px 16px rgba(217,164,65,0.3)",
                  }}
                >
                  + ADD FUNDS
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default IapMarketplaceLayout;
