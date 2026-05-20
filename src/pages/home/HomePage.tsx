import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { Link, useNavigate } from "react-router-dom";
import { usePrivy } from "@privy-io/react-auth";
import { useScrollAnimations, gsap } from "@/hooks/useGSAP";
import { GameButton } from "@/components/ui/game-button";
import { Trophy, ShoppingCart, ArrowRight, Play, ChevronDown, Map, Users, Shield, Menu, X, Swords, Zap, Star, Lock, Crosshair, Crown, CalendarDays, Copy, Check, LogOut, Wallet, LayoutDashboard, ChevronLeft, ChevronRight } from "lucide-react";
import { useLocation } from "react-router-dom";
import { useWallet } from "@/contexts/WalletContext";
import { HARDCODED_TOURNAMENTS } from "@/constants/tournaments";
import { WARRIOR_CHARACTERS } from "@/constants/characters";

import iconCoins from "@/assets/icon-coins.png";
import iconGems from "@/assets/icon-gems.png";

import marketplaceGuns from "@/assets/marketplace-guns.png";
import soldierCard from "@/assets/soldier-card-1-clean.png";
import soldierCardTwo from "@/assets/soldier-card-2.png";
import soldierCardThree from "@/assets/soldier-card-3.png";
import logo from "@/assets/logo.png";
import gameManualPdf from "@/assets/images/Game-manual.pdf";

// Decorative game assets
import decoLamp from "@/assets/deco-lamp.png";
import decoChain from "@/assets/deco-chain.png";
import decoTreasureBox from "@/assets/deco-treasure-box.png";
import decoTreasureBoxGems from "@/assets/treasure-box-gems.png";
import decoMissionLog from "@/assets/deco-mission-log.png";
import decoRubble from "@/assets/deco-rubble.png";
import decoBossBadge from "@/assets/deco-boss-badge.png";
import zgLogo from "@/assets/0G-white-logo.png";

const topPlayers = [
  { rank: 1, name: "Ripkun", coins: 5158977 },
  { rank: 2, name: "JERUZZALEM", coins: 3598546 },
  { rank: 3, name: "Shy", coins: 3187241 },
  { rank: 4, name: "JohnDigger10694", coins: 2715117 },
  { rank: 5, name: "Fate", coins: 2200781 },
];

const NAV_SECTIONS = ["home", "leaderboard", "tournaments", "marketplace"] as const;
type Section = typeof NAV_SECTIONS[number];
const NAV_LABELS: Record<Section, string> = {
  home: "HOME",
  leaderboard: "LEADERBOARD",
  tournaments: "TOURNAMENT",
  marketplace: "STORE",
};

/** Top bar order: Home → Leaderboard → Tournament (section) → Store */
const TOP_NAV_ORDER: Section[] = ["home", "leaderboard", "tournaments", "marketplace"];

const MARQUEE_ITEMS = ["CAMPAIGN", "ARMORY", "CHARACTERS", "BATTLE", "EARN", "UPGRADE", "DOMINATE", "CONQUER"];

export function HomePage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeSection, setActiveSection] = useState<Section>("home");
  const { isConnected, address, disconnect, playerProfile, profileLoading } = useWallet();
  const { ready: privyReady } = usePrivy();
  const navigate = useNavigate();
  const location = useLocation();
  const openLogin = () => navigate('/login', { state: { from: location.pathname } });
  const privyConfigured = Boolean(import.meta.env.VITE_PRIVY_APP_ID);
  const homeTournaments = HARDCODED_TOURNAMENTS.slice(0, 3).map((item, idx) => ({
    ...item,
    image: item.image || [soldierCard, soldierCardTwo, soldierCardThree][idx % 3],
  }));
  const tournamentsLoading = false;
  const [currentCharIdx, setCurrentCharIdx] = useState(0);
  const [copied, setCopied] = useState(false);

  const shortAddress = address ? `${address.slice(0, 6)}...${address.slice(-4)}` : "";
  const coins = Number(playerProfile?.PlayerResources?.coin ?? 0);
  const gems = Number(playerProfile?.PlayerResources?.gem ?? 0);
  const formatResource = (value: number) => value.toLocaleString();

  const handleCopy = async () => {
    if (!address) return;
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch (error) {
      console.error("Failed to copy wallet address:", error);
    }
  };

  useEffect(() => {
    const handleScroll = () => {
      const offsets = NAV_SECTIONS.map(id => {
        const el = document.getElementById(id);
        return el ? { id, top: el.offsetTop - 100 } : null;
      }).filter(Boolean) as { id: Section; top: number }[];
      const scrollY = window.scrollY;
      let current: Section = "home";
      for (const s of offsets) {
        if (scrollY >= s.top) current = s.id;
      }
      setActiveSection(current);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const handlePlayClick = () => {
    if (isConnected) navigate("/game");
    else if (privyConfigured && privyReady) openLogin();
  };

  const gsapRef = useScrollAnimations();
  const heroRef = useRef<HTMLDivElement>(null);

  // Hero parallax on scroll
  useEffect(() => {
    if (!heroRef.current) return;
    const ctx = gsap.context(() => {
      // Parallax the hero background on scroll
      gsap.to(".hero-bg-parallax", {
        yPercent: 25,
        ease: "none",
        scrollTrigger: { trigger: heroRef.current, start: "top top", end: "bottom top", scrub: true },
      });
      // Fade out hero content on scroll
      gsap.to(".hero-content-fade", {
        opacity: 0,
        y: -50,
        ease: "none",
        scrollTrigger: { trigger: heroRef.current, start: "center center", end: "bottom top", scrub: true },
      });
    }, heroRef);
    return () => ctx.revert();
  }, []);

  return (
    <>
      <div ref={gsapRef} className="min-h-screen bg-background relative overflow-x-hidden pb-24 sm:pb-0">

        {/* ===== NAVBAR ===== */}
        <nav className="fixed top-0 left-0 right-0 z-50">
          <div className="bg-background/90 backdrop-blur-xl border-b border-gold/10">
            <div className="container mx-auto px-4 flex items-center justify-between h-14 sm:h-16">
              <Link to="/" className="flex items-center gap-2 group shrink-0">
                <img src={logo} alt="Warzone Warriors" className="w-8 h-8 sm:w-9 sm:h-9 rounded-md object-contain" />
                <div className="hidden sm:block">
                  <span className="font-orbitron font-bold text-sm sm:text-base leading-none">
                    <span className="text-gradient-gold">WARZONE</span>
                    <span className="text-foreground ml-1">WARRIORS</span>
                  </span>
                </div>
              </Link>

              <div className="hidden md:flex items-center gap-1">
                {TOP_NAV_ORDER.map((section) => (
                  <a
                    key={section}
                    href={`#${section}`}
                    className={`relative font-russo text-[11px] tracking-wider px-4 py-2 transition-all inline-flex items-center gap-2 ${
                      activeSection === section ? "text-gold" : "text-muted-foreground hover:text-gold"
                    }`}
                  >
                    {section === "tournaments" && <Crosshair className="w-3.5 h-3.5" />}
                    {NAV_LABELS[section]}
                    {activeSection === section && (
                      <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-4/5 h-[2px] bg-gold rounded-full" />
                    )}
                  </a>
                ))}
              </div>

              <div className="flex items-center gap-2 sm:gap-3">
                {isConnected && (
                  <div className="hidden lg:flex items-center gap-2 mr-1">
                    <CurrencyPill icon={iconCoins} value={profileLoading ? "..." : formatResource(coins)} />
                    <CurrencyPill icon={iconGems} value={profileLoading ? "..." : formatResource(gems)} />
                  </div>
                )}
                <div className="hidden sm:flex items-center gap-1.5 shrink-0">
                  {privyConfigured && !privyReady && !isConnected ? (
                    <div className="h-9 w-28 rounded-md bg-muted/40 animate-pulse border border-border shrink-0" aria-hidden />
                  ) : (
                    <>
                      <GameButton
                        variant="gold"
                        size="sm"
                        disabled={!isConnected && !privyConfigured}
                        onClick={handlePlayClick}
                      >
                        {isConnected ? <Play className="w-3.5 h-3.5 mr-1" /> : <Wallet className="w-3.5 h-3.5 mr-1" />}
                        <span className="hidden sm:inline">{isConnected ? "GAME" : !privyConfigured ? "N/A" : "CONNECT"}</span>
                      </GameButton>
                      {isConnected && (
                        <GameButton
                          variant="metal"
                          size="sm"
                          onClick={() => navigate("/og-dashboard")}
                        >
                          <LayoutDashboard className="w-3.5 h-3.5 mr-1" />
                          <img src={zgLogo} alt="0G" className="hidden lg:block h-7 w-auto" />
                        </GameButton>
                      )}
                      {isConnected && (
                        <button
                          type="button"
                          onClick={() => void disconnect()}
                          className="p-2 rounded-lg border border-border bg-card/50 hover:border-gold/40 text-muted-foreground hover:text-gold transition-colors"
                          title="Log out"
                          aria-label="Log out"
                        >
                          <LogOut className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </>
                  )}
                </div>
                <button className="md:hidden p-2 rounded-lg bg-card/50 border border-border" onClick={() => setMobileMenuOpen(!mobileMenuOpen)} aria-label="Toggle menu">
                  {mobileMenuOpen ? <X className="w-5 h-5 text-gold" /> : <Menu className="w-5 h-5 text-foreground" />}
                </button>
              </div>
            </div>

            {mobileMenuOpen && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="md:hidden border-t border-border bg-card/80 backdrop-blur-md">
                <div className="px-4 py-3 space-y-1">
                  {TOP_NAV_ORDER.map((section) => (
                    <a
                      key={section}
                      href={`#${section}`}
                      onClick={() => setMobileMenuOpen(false)}
                      className={`flex items-center gap-2 px-3 py-2.5 rounded-lg font-russo text-sm transition-all ${
                        activeSection === section ? "text-gold bg-gold/10" : "text-muted-foreground"
                      }`}
                    >
                      {section === "tournaments" && <Crosshair className="w-4 h-4" />}
                      {NAV_LABELS[section]}
                    </a>
                  ))}

                  <div className="pt-4 mt-3 border-t border-gold/15">
                    {isConnected ? (
                      <div className="rounded-xl bg-background/35 border border-gold/20 px-3 py-3">
                        <div className="font-russo text-[10px] tracking-widest text-muted-foreground mb-2">WALLET</div>
                        <div className="flex items-center justify-between gap-2 mb-3">
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse shrink-0" />
                            <span className="font-russo text-xs text-gold truncate">{shortAddress}</span>
                          </div>
                          <button
                            onClick={handleCopy}
                            className="p-1.5 rounded-lg hover:bg-gold/10 transition-colors shrink-0"
                            title="Copy wallet address"
                          >
                            {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4 text-muted-foreground" />}
                          </button>
                        </div>
                        <GameButton
                          variant="gold"
                          size="sm"
                          className="w-full mb-2"
                          onClick={() => {
                            navigate("/game");
                            setMobileMenuOpen(false);
                          }}
                        >
                          <Play className="w-4 h-4 mr-2" />
                          GAME
                        </GameButton>
                        <GameButton
                          variant="metal"
                          size="sm"
                          className="w-full mb-2"
                          onClick={() => {
                            navigate("/og-dashboard");
                            setMobileMenuOpen(false);
                          }}
                        >
                          <LayoutDashboard className="w-4 h-4 mr-2" />
                          0G DASHBOARD
                        </GameButton>
                        <GameButton
                          variant="metal"
                          size="sm"
                          className="w-full"
                          onClick={() => {
                            disconnect();
                            setMobileMenuOpen(false);
                          }}
                        >
                          <LogOut className="w-4 h-4 mr-2" />
                          LOGOUT
                        </GameButton>
                      </div>
                    ) : (
                        <GameButton
                          variant="gold"
                          size="sm"
                          className="w-full"
                          disabled={!privyConfigured || !privyReady}
                          onClick={() => {
                            handlePlayClick();
                            setMobileMenuOpen(false);
                          }}
                        >
                        <Wallet className="w-4 h-4 mr-2" />
                        CONNECT
                      </GameButton>
                    )}
                  </div>
                </div>
              </motion.div>
            )}
            <div className="h-[2px]" style={{ background: "linear-gradient(90deg, transparent, hsl(42,100%,50%) 30%, hsl(42,100%,50%) 70%, transparent)" }} />
          </div>
        </nav>

        {/* ===== HERO ===== */}
        <section ref={heroRef} id="home" className="relative min-h-screen flex items-center overflow-hidden">
           <div className="absolute inset-x-0 top-0 h-[50vh] overflow-hidden md:h-[56.25vw] md:max-h-screen z-0 hero-bg-parallax">
            {/* Video background for both desktop and mobile */}
            <video
              autoPlay
              muted
              playsInline
              className="w-full h-full object-cover object-right md:object-center"
              poster="/videos/hero-poster.jpeg"
              onTimeUpdate={(e) => {
                if (e.currentTarget.currentTime >= 4) {
                  e.currentTarget.currentTime = 0;
                  void e.currentTarget.play();
                }
              }}
            >
              <source src="/videos/hero-bg.mp4" type="video/mp4" />
            </video>
            <div className="absolute inset-0 bg-gradient-to-r from-background/60 via-background/20 to-transparent hidden md:block" />
            <div className="absolute inset-0 bg-gradient-to-t from-background via-background/30 to-transparent md:hidden" />
            <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent hidden md:block" />
            <div className="absolute inset-y-0 right-0 w-24 bg-gradient-to-l from-background via-background/65 to-transparent md:hidden" />
            <img
              src={decoRubble}
              alt=""
              className="absolute -bottom-3 -right-6 w-[5.5rem] z-[2] opacity-70 pointer-events-none md:hidden -scale-x-100"
              style={{ filter: "sepia(0.35) hue-rotate(165deg) saturate(1.15) brightness(0.78)" }}
              loading="lazy"
            />
          </div>

          {/* Decorative chains */}
          <img src={decoChain} alt="" className="absolute left-2 top-1/4 w-6 lg:w-8 z-[5] hidden xl:block opacity-25 pointer-events-none" loading="lazy" />
          <img src={decoChain} alt="" className="absolute right-2 top-1/3 w-5 lg:w-7 z-[5] hidden xl:block opacity-20 pointer-events-none" loading="lazy" />

          {/* Rubble at bottom */}
          <img src={decoRubble} alt="" className="absolute bottom-0 left-0 w-48 sm:w-64 lg:w-80 z-[4] opacity-40 pointer-events-none" loading="lazy" />
          <img src={decoRubble} alt="" className="absolute bottom-0 right-0 w-40 sm:w-56 lg:w-72 z-[4] opacity-30 pointer-events-none -scale-x-100" loading="lazy" />

          <div className="relative z-10 container mx-auto px-4 pt-20 sm:pt-24">
            <div className="max-w-2xl">
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full mb-6 border border-gold/30 bg-background/60 backdrop-blur-sm"
              >
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-accent" />
                </span>
                <span className="font-russo text-[10px] sm:text-xs tracking-widest text-gold flex items-center gap-1.5">
                  POWERED BY <img src={zgLogo} alt="0G" className="h-6 sm:h-7 w-auto" />
                </span>
              </motion.div>

              <motion.h1 initial={{ opacity: 0, x: -40 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.15, duration: 0.7 }}
                className="font-orbitron font-black text-3xl sm:text-6xl md:text-7xl lg:text-8xl mb-5 leading-[1.02]"
              >
                <span className="text-gradient-gold" style={{ filter: "drop-shadow(0 0 30px hsl(42,100%,50%,0.5))" }}>WARZONE</span>
                <br />
                <span className="text-foreground">WARRIORS</span>
              </motion.h1>

              <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.35 }}
                className="font-rajdhani text-lg sm:text-xl md:text-2xl text-muted-foreground mb-8 max-w-lg leading-relaxed"
              >
                The ultimate <span className="text-gold font-bold">Web3 run-and-gun</span> action game.
                Connect your wallet, dominate the battlefield, earn real rewards.
              </motion.p>

              <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}
                className="inline-grid grid-cols-2 gap-3 mb-10"
              >
                <GameButton
                  variant="gold"
                  size="lg"
                  className="animate-pulse-glow w-full h-9 px-4 text-xs sm:h-14 sm:px-8 sm:text-base"
                  disabled={!isConnected && (!privyConfigured || !privyReady)}
                  onClick={handlePlayClick}
                >
                  {isConnected ? (
                    <Play className="w-3 h-3 mr-1 sm:w-5 sm:h-5 sm:mr-2" />
                  ) : (
                    <Wallet className="w-3 h-3 mr-1 sm:w-5 sm:h-5 sm:mr-2" />
                  )}
                  {isConnected ? "GAME" : "CONNECT"}
                </GameButton>
                <a href="#game-features" className="w-full">
                  <GameButton variant="metal" size="lg" className="w-full h-9 px-4 text-xs sm:h-14 sm:px-8 sm:text-base">
                    EXPLORE GAME
                  </GameButton>
                </a>
                <a
                  href={gameManualPdf}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="col-span-2 w-full"
                >
                  <GameButton variant="metal" size="lg" className="w-full h-9 px-4 text-xs sm:h-14 sm:px-8 sm:text-base">
                    GAME MANUAL
                  </GameButton>
                </a>
              </motion.div>

              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.65 }}
                className="flex gap-8 sm:gap-10"
              >
                {/* <HUDStat value="50K+" label="PLAYERS" /> */}
                {/* <HUDStat value="$2M+" label="EARNED" /> */}
                {/* <HUDStat value="100K+" label="BATTLES" /> */}
              </motion.div>
            </div>
          </div>

          <motion.a href="#game-features" animate={{ y: [0, 8, 0] }} transition={{ duration: 1.5, repeat: Infinity }}
            className="absolute bottom-8 left-1/2 -translate-x-1/2 text-gold/60 z-10"
          >
            <ChevronDown className="w-7 h-7" />
          </motion.a>
        </section>

        {/* ===== HAZARD STRIPE DIVIDER ===== */}
        <div className="relative z-10">
          <div className="hazard-stripe-sm h-3" />
        </div>

        {/* ===== SCROLLING MARQUEE ===== */}
        <div className="relative z-10 overflow-hidden py-4 sm:py-5 border-b border-gold/20" style={{
          background: "linear-gradient(90deg, hsl(20,35%,6%) 0%, hsl(20,30%,10%) 50%, hsl(20,35%,6%) 100%)",
        }}>
          <div className="flex animate-marquee whitespace-nowrap">
            {[...MARQUEE_ITEMS, ...MARQUEE_ITEMS].map((item, i) => (
              <span key={i} className="flex items-center mx-6 sm:mx-10">
                <Star className="w-4 h-4 sm:w-5 sm:h-5 text-gold mr-3 sm:mr-4" fill="hsl(42,100%,50%)" />
                <span className="font-orbitron text-lg sm:text-2xl md:text-3xl font-black text-foreground tracking-wider">{item}</span>
              </span>
            ))}
          </div>
        </div>

        {/* ===== MISSION BRIEFING SECTION ===== */}
        <section id="game-features" className="relative z-10 py-16 sm:py-24 overflow-hidden">
          <div className="absolute inset-x-0 top-0 h-[50vh] md:h-[56.25vw] md:max-h-screen z-0 overflow-hidden">
            <video autoPlay muted loop playsInline className="w-full h-full object-cover opacity-30">
              <source src="/videos/war-scene.mp4" type="video/mp4" />
            </video>
            <div className="absolute inset-0 bg-background/60" />
          </div>

          {/* Decorative mission log on left */}
          <motion.img src={decoMissionLog} alt="" 
            className="absolute -left-8 sm:left-4 top-8 w-24 sm:w-32 lg:w-40 z-[1] opacity-40 lg:opacity-60 pointer-events-none -rotate-6"
            animate={{ rotate: [-6, -4, -6] }} transition={{ duration: 4, repeat: Infinity }} loading="lazy"
          />

          {/* Decorative lamp right side */}
          <motion.img src={decoLamp} alt=""
            className="absolute right-2 top-6 w-14 sm:w-18 lg:w-24 z-[1] opacity-50 pointer-events-none"
            animate={{ filter: ["drop-shadow(0 0 12px hsl(28,100%,50%,0.5))", "drop-shadow(0 0 24px hsl(28,100%,50%,0.8))", "drop-shadow(0 0 12px hsl(28,100%,50%,0.5))"] }}
            transition={{ duration: 3, repeat: Infinity }} loading="lazy"
          />

          <div className="container mx-auto px-4 relative z-10">
            <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-12 sm:mb-16">
              <div className="inline-flex items-center gap-2 px-4 py-2 mb-4 rounded border border-gold/30 bg-card/60">
                <div className="w-2.5 h-2.5 rounded-full bg-accent" style={{ boxShadow: "0 0 8px hsl(120,80%,45%,0.6)" }} />
                <span className="font-pixel text-[8px] sm:text-[10px] tracking-widest text-gold">MISSION LOG // ACTIVE</span>
              </div>
              <h2 data-gsap="text-reveal" className="font-orbitron text-3xl sm:text-4xl md:text-6xl font-black mb-4">
                <span className="text-foreground">YOUR </span>
                <span className="text-gradient-gold">WORLD</span>
                <br />
                <span className="text-foreground">YOUR </span>
                <span className="text-gradient-sunset">ADVENTURE</span>
              </h2>
              <p className="font-rajdhani text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto">
                Warzone Warriors transforms your gameplay into a Web3 powered battlefield where every victory counts.
              </p>
            </motion.div>

            <div data-gsap="stagger-children" className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 sm:gap-4 max-w-4xl mx-auto">
              {[
                { icon: <Swords className="w-6 h-6 sm:w-8 sm:h-8" />, label: "Battle", desc: "PvP combat" },
                { icon: <Map className="w-6 h-6 sm:w-8 sm:h-8" />, label: "Campaign", desc: "Story missions" },
                { icon: <Shield className="w-6 h-6 sm:w-8 sm:h-8" />, label: "Armory", desc: "Gear up" },
                { icon: <Users className="w-6 h-6 sm:w-8 sm:h-8" />, label: "Squad", desc: "Team play" },
                { icon: <Zap className="w-6 h-6 sm:w-8 sm:h-8" />, label: "Earn", desc: "Real rewards" },
              ].map((item, i) => (
                <motion.div key={i} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.08 }}
                  whileHover={{ y: -6, scale: 1.03 }}
                  className="flex items-center gap-3 p-4 sm:p-5 rounded-xl border border-border bg-card/40 backdrop-blur-sm hover:border-gold/40 transition-all cursor-pointer group"
                >
                  <div className="text-gold group-hover:text-foreground transition-colors shrink-0">{item.icon}</div>
                  <div>
                    <div className="font-russo text-xs sm:text-sm text-foreground leading-tight">{item.label}</div>
                    <div className="font-rajdhani text-[10px] sm:text-xs text-muted-foreground">{item.desc}</div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* ===== HAZARD STRIPE DIVIDER ===== */}
        <div className="relative z-10">
          <div className="hazard-stripe-sm h-3" />
        </div>

        {/* ===== GAME FEATURES ===== */}
        {/* <section id="game-features" className="relative z-10 py-16 sm:py-24 bg-background overflow-hidden">
          <motion.img src={decoLamp} alt="" className="absolute top-10 left-4 w-16 lg:w-24 z-[1] opacity-60 pointer-events-none -scale-x-100 hidden lg:block"
            animate={{ filter: ["drop-shadow(0 0 15px hsl(28,100%,50%,0.5))", "drop-shadow(0 0 30px hsl(28,100%,50%,0.8))", "drop-shadow(0 0 15px hsl(28,100%,50%,0.5))"] }}
            transition={{ duration: 2, repeat: Infinity }} loading="lazy"
          />
          <motion.img src={decoLamp} alt="" className="absolute top-10 right-4 w-16 lg:w-24 z-[1] opacity-60 pointer-events-none hidden lg:block"
            animate={{ filter: ["drop-shadow(0 0 15px hsl(28,100%,50%,0.5))", "drop-shadow(0 0 30px hsl(28,100%,50%,0.8))", "drop-shadow(0 0 15px hsl(28,100%,50%,0.5))"] }}
            transition={{ duration: 2.5, repeat: Infinity, delay: 1 }} loading="lazy"
          />

          <img src={decoChain} alt="" className="absolute left-12 -top-4 w-6 lg:w-8 z-[1] opacity-30 pointer-events-none hidden xl:block" loading="lazy" />
          <img src={decoChain} alt="" className="absolute right-12 -top-4 w-6 lg:w-8 z-[1] opacity-30 pointer-events-none hidden xl:block" loading="lazy" />

          <motion.img src={decoBossBadge} alt="" className="absolute bottom-16 right-8 w-16 lg:w-24 z-[1] opacity-30 pointer-events-none hidden lg:block"
            animate={{ y: [0, -5, 0] }} transition={{ duration: 3, repeat: Infinity }} loading="lazy"
          />

          <div className="container mx-auto px-4 relative z-10">
            <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-10 sm:mb-14">
              <p className="font-russo text-xs tracking-[0.3em] text-gold mb-3">EXPLORE THE GAME</p>
              <h2 data-gsap="text-reveal" className="font-orbitron text-3xl sm:text-4xl md:text-5xl font-black">
                <span className="text-foreground">GAME </span>
                <span className="text-gradient-gold">FEATURES</span>
              </h2>
            </motion.div>

            <div className="md:hidden mb-10">
              <GameFeaturesCarousel handlePlayClick={handlePlayClick} />
            </div>

            <div data-gsap="stagger-children" className="hidden md:grid grid-cols-3 gap-4 sm:gap-6 max-w-6xl mx-auto mb-10">
              {GAME_FEATURES.map((feat, i) => (
                <GameFeatureCard key={i} feat={feat} index={i} />
              ))}
            </div>

            <div className="text-center">
              <GameButton variant="gold" size="lg" onClick={handlePlayClick}>
                <Play className="w-5 h-5 mr-2" />
                START PLAYING
              </GameButton>
            </div>
          </div>
        </section> */}

        {/* ===== CHARACTER SPOTLIGHT ===== */}
        <section className="relative z-10 py-16 sm:py-24 overflow-hidden border-t-2 border-metal/40">
          {/* Chains on sides */}
          <img src={decoChain} alt="" className="absolute right-4 top-8 w-6 lg:w-8 opacity-20 pointer-events-none hidden xl:block" loading="lazy" />
          <img src={decoChain} alt="" className="absolute left-4 top-16 w-5 lg:w-7 opacity-15 pointer-events-none hidden xl:block" loading="lazy" />

          {/* Rubble decoration */}
          <img src={decoRubble} alt="" className="absolute bottom-0 right-0 w-48 lg:w-72 opacity-25 pointer-events-none" loading="lazy" />

          <div className="absolute inset-x-0 top-0 h-[50vh] md:h-[56.25vw] md:max-h-screen z-0 overflow-hidden">
            <video autoPlay muted loop playsInline className="w-full h-full object-cover opacity-25">
              <source src="/videos/action.mp4" type="video/mp4" />
            </video>
            <div className="absolute inset-0 bg-background/65" />
          </div>
          <div className="absolute inset-0 z-0" style={{ background: "radial-gradient(ellipse at 30% 50%, hsl(28,100%,50%,0.08) 0%, transparent 60%)" }} />
          <button
            type="button"
            onClick={() => setCurrentCharIdx((prev) => (prev === 0 ? WARRIOR_CHARACTERS.length - 1 : prev - 1))}
            className="hidden sm:flex absolute left-[clamp(0.75rem,2vw,2.5rem)] top-1/2 -translate-y-1/2 z-20 h-[clamp(2.25rem,3.2vw,3rem)] w-[clamp(2.25rem,3.2vw,3rem)] items-center justify-center rounded-full bg-card/60 hover:bg-gold/20 border border-border transition-colors text-gold"
            aria-label="Previous warrior"
          >
            <ChevronLeft className="h-[clamp(1.1rem,1.6vw,1.5rem)] w-[clamp(1.1rem,1.6vw,1.5rem)]" />
          </button>
          <button
            type="button"
            onClick={() => setCurrentCharIdx((prev) => (prev === WARRIOR_CHARACTERS.length - 1 ? 0 : prev + 1))}
            className="hidden sm:flex absolute right-[clamp(0.75rem,2vw,2.5rem)] top-1/2 -translate-y-1/2 z-20 h-[clamp(2.25rem,3.2vw,3rem)] w-[clamp(2.25rem,3.2vw,3rem)] items-center justify-center rounded-full bg-card/60 hover:bg-gold/20 border border-border transition-colors text-gold"
            aria-label="Next warrior"
          >
            <ChevronRight className="h-[clamp(1.1rem,1.6vw,1.5rem)] w-[clamp(1.1rem,1.6vw,1.5rem)]" />
          </button>
          <div className="container mx-auto px-4 relative z-10">
            <div className="grid grid-cols-1 sm:grid-cols-2 items-center gap-5 sm:gap-4 md:gap-6 lg:gap-8 max-w-6xl mx-auto relative">
              <motion.div
                data-gsap="fade-left"
                initial={{ opacity: 0, x: -30 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                className="relative w-full h-[300px] sm:h-[360px] md:h-[420px] lg:h-[480px] flex justify-center items-center"
              >
                <div className="relative">
                  <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-40 h-8 rounded-full bg-gold/20 blur-xl" />
                  <motion.img
                    key={currentCharIdx}
                    src={WARRIOR_CHARACTERS[currentCharIdx].image}
                    alt={WARRIOR_CHARACTERS[currentCharIdx].name}
                    className="w-52 sm:w-56 md:w-64 lg:w-80 drop-shadow-2xl relative z-10"
                    initial={{ opacity: 0, scale: WARRIOR_CHARACTERS[currentCharIdx].scale * 0.9 }}
                    animate={{ opacity: 1, scale: WARRIOR_CHARACTERS[currentCharIdx].scale, y: [0, -10, 0] }}
                    transition={{ opacity: { duration: 0.3 }, scale: { duration: 0.3 }, y: { duration: 3, repeat: Infinity } }}
                    style={{ filter: "drop-shadow(0 20px 40px hsl(28,100%,50%,0.3))" }}
                    loading="lazy"
                  />
                </div>
              </motion.div>
              <motion.div
                data-gsap="fade-right"
                initial={{ opacity: 0, x: 30 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                className="w-full min-w-0 text-center sm:text-left"
              >
                <p className="font-russo text-xs tracking-[0.3em] text-gold mb-2">MEET YOUR WARRIOR</p>
                <motion.h2
                  key={`title-${currentCharIdx}`}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="font-orbitron text-3xl sm:text-[2rem] md:text-4xl lg:text-5xl font-black text-foreground mb-4"
                >
                  {WARRIOR_CHARACTERS[currentCharIdx].titleBase}{" "}
                  <span className="text-gradient-gold">{WARRIOR_CHARACTERS[currentCharIdx].titleHighlight}</span>
                </motion.h2>
                <motion.p
                  key={`desc-${currentCharIdx}`}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="font-rajdhani text-base sm:text-lg text-muted-foreground mb-6 max-w-md mx-auto sm:mx-0 leading-relaxed min-h-16"
                >
                  {WARRIOR_CHARACTERS[currentCharIdx].description}
                </motion.p>

                <div className="space-y-3 mb-6 max-w-xs sm:max-w-sm mx-auto sm:mx-0">
                  {WARRIOR_CHARACTERS[currentCharIdx].stats.map((stat) => (
                    <div key={stat.label}>
                      <div className="flex justify-between mb-1">
                        <span className="font-russo text-[10px] text-muted-foreground">{stat.label}</span>
                        <span className="font-orbitron text-[10px] text-gold">{stat.value}%</span>
                      </div>
                      <div className="h-2 rounded-full bg-muted/50 overflow-hidden border border-border/50">
                        <motion.div
                          key={`stat-${currentCharIdx}-${stat.label}`}
                          initial={{ width: 0 }}
                          animate={{ width: `${stat.value}%` }}
                          transition={{ duration: 1 }}
                          className="h-full rounded-full"
                          style={{
                            background: `linear-gradient(90deg, ${stat.color}, ${stat.color}80)`,
                            boxShadow: `0 0 8px ${stat.color}60`,
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex flex-wrap justify-center sm:justify-start gap-3 mb-6 min-h-[36px]">
                  {WARRIOR_CHARACTERS[currentCharIdx].locks.map((name) => (
                    <motion.div
                      key={`lock-${currentCharIdx}-${name}`}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-card/40"
                    >
                      <Lock className="w-3.5 h-3.5 text-muted-foreground" />
                      <span className="font-rajdhani text-xs text-muted-foreground">{name}</span>
                    </motion.div>
                  ))}
                </div>

                <div className="flex justify-center sm:justify-start gap-2">
                  {WARRIOR_CHARACTERS.map((char, idx) => (
                    <button
                      key={char.name}
                      type="button"
                      onClick={() => setCurrentCharIdx(idx)}
                      className={`h-2 rounded-full transition-all ${
                        idx === currentCharIdx ? "w-8 bg-gold" : "w-2 bg-muted-foreground/40 hover:bg-gold/50"
                      }`}
                      aria-label={`Show ${char.name}`}
                    />
                  ))}
                </div>
              </motion.div>
            </div>
          </div>
        </section>

        {/* ===== HAZARD STRIPE DIVIDER ===== */}
        <div className="relative z-10">
          <div className="hazard-stripe-sm h-3" />
        </div>

        {/* ===== LEADERBOARD ===== */}
        <section id="leaderboard" className="relative z-10 py-16 sm:py-24 border-t border-border bg-card/20 overflow-hidden">
          {/* Decorative lamps */}
          <motion.img src={decoLamp} alt="" className="absolute top-6 left-4 w-14 lg:w-20 z-[1] opacity-50 pointer-events-none -scale-x-100 hidden lg:block"
            animate={{ filter: ["drop-shadow(0 0 10px hsl(28,100%,50%,0.4))", "drop-shadow(0 0 22px hsl(28,100%,50%,0.7))", "drop-shadow(0 0 10px hsl(28,100%,50%,0.4))"] }}
            transition={{ duration: 2.5, repeat: Infinity }} loading="lazy"
          />
          <motion.img src={decoLamp} alt="" className="absolute top-6 right-4 w-14 lg:w-20 z-[1] opacity-50 pointer-events-none hidden lg:block"
            animate={{ filter: ["drop-shadow(0 0 10px hsl(28,100%,50%,0.4))", "drop-shadow(0 0 22px hsl(28,100%,50%,0.7))", "drop-shadow(0 0 10px hsl(28,100%,50%,0.4))"] }}
            transition={{ duration: 3, repeat: Infinity, delay: 1.2 }} loading="lazy"
          />

          {/* Boss badge decoration */}
          <motion.img src={decoBossBadge} alt="" className="absolute bottom-8 left-8 w-14 lg:w-20 z-[1] opacity-20 pointer-events-none hidden md:block"
            animate={{ y: [0, -4, 0], rotate: [0, 3, 0] }} transition={{ duration: 4, repeat: Infinity }} loading="lazy"
          />

          <div className="container mx-auto px-4 relative z-10">
            <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-10 sm:mb-14">
              <h2 data-gsap="text-reveal" className="font-orbitron text-3xl sm:text-4xl md:text-5xl font-black">
                <span className="text-foreground">TOP </span>
                <span className="text-gradient-gold">WARRIORS</span>
              </h2>
            </motion.div>

            <div data-gsap="stagger-children" className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 sm:gap-4 max-w-4xl mx-auto mb-10">
              {topPlayers.map((player, i) => (
                <motion.div key={player.rank} initial={{ opacity: 0, y: 15 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.08 }}
                  whileHover={{ y: -6, scale: 1.02 }}
                  className={`rounded-xl p-4 sm:p-5 text-center border-2 transition-all cursor-pointer ${
                    player.rank === 1 
                      ? "border-gold/50 bg-gold/5 shadow-lg shadow-gold/10" 
                      : player.rank <= 3
                        ? "border-primary/30 bg-primary/5"
                        : "border-metal/40 bg-card/40 hover:border-gold/30"
                  }`}
                >
                  <div className="text-2xl sm:text-3xl mb-2">
                    {player.rank === 1 ? "👑" : player.rank === 2 ? "🥈" : player.rank === 3 ? "🥉" : (
                      <span className="font-orbitron text-base font-bold text-muted-foreground">#{player.rank}</span>
                    )}
                  </div>
                  <div className="font-russo text-xs sm:text-sm text-foreground truncate mb-2">{player.name}</div>
                  <div className="flex items-center justify-center gap-1.5">
                    <img src={iconCoins} alt="" className="w-4 h-4" loading="lazy" />
                    <span className="font-orbitron text-[10px] sm:text-xs font-bold text-gradient-gold">{player.coins.toLocaleString()}</span>
                  </div>
                </motion.div>
              ))}
            </div>

            <div className="text-center">
              <Link to="/leaderboard">
                <GameButton variant="gold" size="lg" className="group">
                  <Trophy className="w-5 h-5 mr-2" />
                  FULL LEADERBOARD
                  <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                </GameButton>
              </Link>
            </div>
          </div>
        </section>

        {/* ===== TOURNAMENT PREVIEW ===== */}
        <section id="tournaments" className="relative z-10 py-16 sm:py-24 border-t-2 border-metal/40 overflow-hidden" style={{
          background: "linear-gradient(180deg, hsl(20,30%,6%) 0%, hsl(20,25%,10%) 50%, hsl(20,30%,6%) 100%)",
        }}>
          <div className="container mx-auto px-4 relative z-10">
            <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-10 sm:mb-14">
              <p className="font-russo text-xs tracking-[0.3em] text-gold mb-3">COMPETITIVE OPS</p>
              <h2 data-gsap="text-reveal" className="font-orbitron text-3xl sm:text-4xl md:text-5xl font-black">
                <span className="text-foreground">LIVE </span>
                <span className="text-gradient-gold">TOURNAMENTS</span>
              </h2>
              <p className="font-rajdhani text-base sm:text-lg text-muted-foreground max-w-xl mx-auto mt-3">
                Enter the warzone circuit. Compete in live brackets and claim glory.
              </p>
            </motion.div>

            {tournamentsLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="inline-flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full bg-gold animate-pulse" />
                  <span className="font-russo text-sm tracking-widest text-gold">LOADING TOURNAMENTS</span>
                </div>
              </div>
            ) : homeTournaments.length > 0 ? (
              <div data-gsap="stagger-children" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 max-w-5xl mx-auto mb-10">
                {homeTournaments.map((t, i) => {
                  const now = Date.now();
                  const startMs = Number(t.startDate || 0);
                  const endMs = Number(t.endDate || 0);
                  const normalizedStatus = String(t.status || "").toUpperCase();
                  const isLiveStatus = ["RUNNING", "ACTIVE", "LIVE", "IN_PROGRESS"].includes(normalizedStatus);
                  const isEndedStatus = ["COMPLETED", "ENDED", "FINISHED", "DONE", "CLOSED"].includes(normalizedStatus);
                  const isUpcomingStatus = ["UPCOMING", "SCHEDULED", "PENDING"].includes(normalizedStatus);
                  const isLive = isLiveStatus || (
                    Number.isFinite(startMs) && startMs > 0 &&
                    Number.isFinite(endMs) && endMs > 0 &&
                    startMs <= now && now <= endMs
                  );
                  const isPastTournament =
                    isEndedStatus ||
                    (Number.isFinite(endMs) && endMs > 0 && endMs < now);
                  const isUpcomingTournament =
                    !isPastTournament &&
                    (isUpcomingStatus || (Number.isFinite(startMs) && startMs > now));
                  const displayStatus = isPastTournament ? "ENDED" : isLive ? "ACTIVE" : isUpcomingTournament ? "UPCOMING" : "UPCOMING";
                  const roundCount = (t.rounds || []).length;
                  const fmtDate = (ms?: number) => ms ? new Date(ms).toLocaleDateString(undefined, { day: "numeric", month: "short" }) : "TBA";

                  return (
                    <motion.div key={String(t.id)} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }}
                      whileHover={{ y: -8, scale: 1.02 }}
                      className="group"
                    >
                        <div className={`rounded-2xl overflow-hidden border transition-all duration-300 ${
                          isLive
                            ? "border-gold/45 shadow-[0_0_35px_rgba(255,198,71,0.18)]"
                            : isPastTournament
                              ? "border-border/60"
                              : "border-border/80 hover:border-gold/35 hover:shadow-[0_0_28px_rgba(255,198,71,0.14)]"
                        }`} style={{
                          background: "linear-gradient(180deg, rgba(34,24,16,0.96) 0%, rgba(14,11,10,0.98) 100%)",
                        }}>
                          {/* Image */}
                          <div className="relative h-40 sm:h-48 overflow-hidden">
                            <img
                              src={t.image}
                              alt={t.name}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                              loading="lazy"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-background via-background/55 to-transparent" />
                            <div className="absolute top-3 left-3 flex items-center gap-2">
                              <span className={`px-2.5 py-1 rounded-full font-russo text-[10px] tracking-widest ${
                                isLive
                                  ? "bg-gold text-background"
                                  : isPastTournament
                                    ? "bg-rose-500/20 border border-rose-400/40 text-rose-200"
                                    : "bg-sky-500/20 border border-sky-400/40 text-sky-200"
                              }`}>
                                {isLive && <Crown className="w-3 h-3 inline mr-1" />}
                                {displayStatus}
                              </span>
                            </div>
                            <div className="absolute inset-x-0 bottom-0 p-4">
                              <h3 className="font-orbitron text-lg font-bold text-foreground truncate">{t.name}</h3>
                              <p className="font-rajdhani text-xs text-muted-foreground">{fmtDate(t.startDate)} – {fmtDate(t.endDate)}</p>
                            </div>
                          </div>

                          {/* Info */}
                          <div className="p-4 sm:p-5">
                            <div className="grid grid-cols-2 gap-2.5 mb-3">
                              <div className="rounded-xl border border-border/70 bg-background/35 px-3 py-2.5">
                                <div className="font-russo text-[9px] tracking-widest text-muted-foreground">ROUNDS</div>
                                <div className="font-orbitron text-sm font-bold text-foreground">{roundCount}</div>
                              </div>
                              <div className="rounded-xl border border-border/70 bg-background/35 px-3 py-2.5">
                                <div className="font-russo text-[9px] tracking-widest text-muted-foreground">STATUS</div>
                                <div className={`font-orbitron text-sm font-bold ${isLive ? "text-gold" : isPastTournament ? "text-rose-300" : "text-sky-300"}`}>
                                  {displayStatus}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center justify-between border-t border-border/50 pt-3">
                              <span className="font-rajdhani text-xs text-muted-foreground">Live on home</span>
                              <Crown className="w-4 h-4 text-gold opacity-70" />
                            </div>
                          </div>
                        </div>
                    </motion.div>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-2xl border border-gold/20 bg-card/30 px-6 py-10 text-center max-w-md mx-auto mb-10">
                <CalendarDays className="w-8 h-8 text-gold mx-auto mb-3" />
                <div className="font-russo text-sm tracking-widest text-gold mb-1">NO ACTIVE TOURNAMENTS</div>
                <p className="font-rajdhani text-sm text-muted-foreground">Check back soon for the next deployment wave.</p>
              </div>
            )}

            <div className="text-center">
              <Link to="/tournament">
                <GameButton variant="gold" size="lg" className="group">
                  <Crosshair className="w-5 h-5 mr-2" />
                  ALL TOURNAMENTS
                  <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                </GameButton>
              </Link>
            </div>
          </div>
        </section>

        {/* ===== STORE ===== */}
        <section id="marketplace" className="relative z-10 py-16 sm:py-24 border-t-2 border-metal/40 bg-background overflow-hidden">
          {/* Decorative treasure boxes on sides */}
          <motion.img src={decoTreasureBox} alt="" className="absolute bottom-8 left-6 w-20 lg:w-28 z-[1] opacity-30 pointer-events-none hidden md:block"
            animate={{ y: [0, -3, 0] }} transition={{ duration: 3, repeat: Infinity }} loading="lazy"
            style={{ filter: "brightness(0.7)" }}
          />
          <motion.img src={decoTreasureBox} alt="" className="absolute bottom-12 right-6 w-16 lg:w-24 z-[1] opacity-25 pointer-events-none hidden md:block -scale-x-100"
            animate={{ y: [0, -4, 0] }} transition={{ duration: 3.5, repeat: Infinity, delay: 0.5 }} loading="lazy"
            style={{ filter: "brightness(0.6)" }}
          />

          {/* Chains */}
          <img src={decoChain} alt="" className="absolute left-8 top-0 w-5 lg:w-7 opacity-20 pointer-events-none hidden xl:block" loading="lazy" />
          <img src={decoChain} alt="" className="absolute right-8 top-0 w-5 lg:w-7 opacity-20 pointer-events-none hidden xl:block" loading="lazy" />

          <div className="container mx-auto px-4 relative z-10">
            <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-10 sm:mb-14">
              <p className="font-russo text-xs tracking-[0.3em] text-gold mb-3">POWER UP</p>
              <h2 data-gsap="text-reveal" className="font-orbitron text-3xl sm:text-4xl md:text-5xl font-black">
                <span className="text-foreground">IN-GAME </span>
                <span className="text-gradient-gold">STORE</span>
              </h2>
            </motion.div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 max-w-4xl mx-auto mb-10">
              {[
                { title: "COINS", desc: "In-game currency for upgrades and purchases", image: decoTreasureBox, glowColor: "hsl(42,100%,50%)", link: "/iap?category=coins", price: "1200 / 1800 SS" },
                { title: "GEMS", desc: "Premium currency for exclusive items", image: decoTreasureBoxGems, glowColor: "hsl(220,80%,60%)", link: "/iap?category=gems", price: "500 / 800 SS" },
                { title: "GUNS", desc: "Powerful weapons to dominate battle", image: marketplaceGuns, glowColor: "hsl(28,100%,50%)", link: "/iap?category=guns", price: "1200 / 1800 SS" },
              ].map((cat, i) => (
                <Link key={i} to={cat.link}>
                  <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }}
                    whileHover={{ y: -8, scale: 1.02 }}
                    className="text-center p-6 sm:p-8 rounded-2xl border-2 border-metal/50 bg-card/30 hover:border-gold/30 transition-all cursor-pointer group"
                  >
                    <motion.img src={cat.image} alt={cat.title}
                      className="w-20 h-20 sm:w-24 sm:h-24 mx-auto mb-4 object-contain"
                      animate={{ y: [0, -6, 0] }} transition={{ duration: 2.5, repeat: Infinity, delay: i * 0.3 }}
                      style={{ filter: `drop-shadow(0 0 15px ${cat.glowColor})` }}
                      loading="lazy"
                    />
                    <h3 className="font-orbitron text-lg sm:text-xl font-bold mb-1" style={{ color: cat.glowColor }}>{cat.title}</h3>
                    <p className="font-rajdhani text-xs sm:text-sm text-muted-foreground mb-3">{cat.desc}</p>
                    <div className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-gold/10 border border-gold/20">
                      <span className="font-orbitron text-[10px] text-gold">{cat.price}</span>
                    </div>
                  </motion.div>
                </Link>
              ))}
            </div>

            <div className="text-center">
              <Link to="/iap">
                <GameButton variant="primary" size="lg" className="group">
                  <ShoppingCart className="w-5 h-5 mr-2" />
                  VISIT STORE
                  <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                </GameButton>
              </Link>
            </div>
          </div>
        </section>

        {/* ===== HAZARD STRIPE DIVIDER ===== */}
        <div className="relative z-10">
          <div className="hazard-stripe-sm h-3" />
        </div>

        {/* ===== FOOTER ===== */}
        <footer className="relative z-10 py-10 sm:py-14 border-t border-border bg-card/20">
          <div className="container mx-auto px-4">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
              <div className="flex items-center gap-3">
                <img src={logo} alt="Warzone Warriors" className="w-8 h-8 rounded-md object-contain" />
                <span className="font-orbitron font-bold text-sm text-gradient-gold">WARZONE WARRIORS</span>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-6">
                {TOP_NAV_ORDER.map((section) => (
                  <a
                    key={section}
                    href={`#${section}`}
                    className="font-russo text-[10px] tracking-wider text-muted-foreground hover:text-gold transition-colors"
                  >
                    {NAV_LABELS[section]}
                  </a>
                ))}
              </div>
              <p className="font-rajdhani text-xs text-muted-foreground">
                © 2026 Warzone Warriors. Powered by <img src={zgLogo} alt="0G" className="inline h-5 w-auto align-middle mx-1" />.
                {" "}
                <Link
                  to="/game2"
                  className="text-[8px] opacity-45 hover:opacity-70 underline underline-offset-2"
                >
                  upcoming
                </Link>
              </p>
            </div>
          </div>
        </footer>
      </div>

    </>
  );
}

const CurrencyPill = ({ icon, value }: { icon: string; value: string }) => (
  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-russo bg-card/60 border border-border/50">
    <img src={icon} alt="" className="w-4 h-4 object-contain" />
    <span className="font-orbitron text-[11px] font-bold text-foreground">{value}</span>
  </div>
);

const HUDStat = ({ value, label }: { value: string; label: string }) => (
  <div>
    <div className="font-orbitron text-2xl sm:text-3xl md:text-4xl font-bold text-gradient-gold">{value}</div>
    <div className="font-russo text-[9px] sm:text-[10px] tracking-widest text-muted-foreground mt-1">{label}</div>
  </div>
);

export default HomePage;
