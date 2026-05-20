import { useState, useRef, useEffect, useCallback } from 'react';
import './GamePage.css';
import { useNavigate } from 'react-router-dom';
import { useWallet } from '../../contexts/WalletContext';
import { buildApiUrl } from '../../config/api';
import { Home, Maximize2, X } from 'lucide-react';
import centerImage from "../../assets/images/abc1.png";
import gameBackground from '../../assets/hero-web3.png';
import ThemedBackButton from '../../components/ThemedBackButton';
import { useSignMessage } from 'wagmi';

// ── 0G WarzoneWarrior backend ──────────────────────────────────────────────
const ZG_BACKEND = 'https://zerog-warzonewarriors.onrender.com';
const ZG_JWT_KEY = 'ZGJwt';

function isJwtExpired(token: string): boolean {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    // Treat as expired 5 minutes before actual expiry to avoid edge cases
    return Date.now() >= (payload.exp * 1000) - 5 * 60 * 1000;
  } catch {
    return true;
  }
}

export const Game = () => {
  const [isLoading, setIsLoading]   = useState(true);
  const [showIframe, setShowIframe] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [openRounds, setOpenRounds]   = useState([]);
  const [selectedRound, setSelectedRound] = useState(null);
  const [showRoundPicker, setShowRoundPicker] = useState(false);
  const [zgJwt, setZgJwt] = useState<string | null>(null);

  const loadedRef  = useRef(false);
  const iframeRef  = useRef(null);
  const containerRef = useRef(null);
  const hasRunRef  = useRef(false);

  const navigate = useNavigate();
  const { isConnected, address } = useWallet();
  const { signMessageAsync } = useSignMessage();

  const walletAddress = address || localStorage.getItem('walletAddress');
  const activeRoundIdRef = useRef(null);

  // ── 0G SIWE auth ─────────────────────────────────────────────────────────
  // Gets a JWT from the 0G backend. Uses cached token (localStorage) if still
  // valid. On success, stores the JWT so Unity can read it from the iframe URL.
  // Failures are non-fatal — game loads without 0G features, legacy API is used.

  const doZGAuth = useCallback(async (wallet: string): Promise<string | null> => {
    // Re-use existing token if still valid
    const cached = localStorage.getItem(ZG_JWT_KEY);
    if (cached && !isJwtExpired(cached)) {
      return cached;
    }

    // Token missing or expired — do fresh SIWE
    try {
      const nonceRes = await fetch(`${ZG_BACKEND}/auth/nonce?wallet=${encodeURIComponent(wallet)}`);
      if (!nonceRes.ok) throw new Error(`Nonce fetch failed: ${nonceRes.status}`);
      const { nonce, message } = await nonceRes.json();

      // Ask the connected wallet to sign the SIWE message
      const signature = await signMessageAsync({ message });

      const loginRes = await fetch(`${ZG_BACKEND}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wallet, signature, nonce }),
      });
      if (!loginRes.ok) throw new Error(`Login failed: ${loginRes.status}`);
      const { token } = await loginRes.json();
      if (!token) throw new Error('No token in response');

      localStorage.setItem(ZG_JWT_KEY, token);
      return token;
    } catch (err) {
      console.warn('[Game] 0G auth skipped (non-fatal):', (err as Error).message);
      return null;
    }
  }, [signMessageAsync]);

  // ── Tournament rounds ─────────────────────────────────────────────────────

  function resolveOpenRounds(tournaments) {
    const now = Date.now();
    const tournament =
      tournaments.find((t) => t.status === 'RUNNING') ||
      tournaments.find((t) => t.status === 'UPCOMING') ||
      tournaments[0];

    if (!tournament || !Array.isArray(tournament.rounds)) return [];

    const open = tournament.rounds.filter((round) => {
      if (!Array.isArray(round.intervals)) return false;
      return round.intervals.some((iv) => now >= iv.startDate && now <= iv.endDate);
    });

    if (open.length > 0) return open;

    const fallback = tournament.rounds[0];
    return fallback ? [fallback] : [];
  }

  useEffect(() => {
    fetch(buildApiUrl('/intraverse/tournaments?slug=warzone-warriors&size=20'))
      .then((r) => r.json())
      .then((data) => {
        const list = data?.body?.data || [];
        const rounds = resolveOpenRounds(list);
        if (rounds.length === 1) {
          activeRoundIdRef.current = rounds[0].id;
          setSelectedRound(rounds[0]);
        } else if (rounds.length > 1) {
          setOpenRounds(rounds);
          setShowRoundPicker(true);
        }
      })
      .catch(() => {});
  }, []);

  // ── GAME_OVER postMessage → submit score ──────────────────────────────────

  useEffect(() => {
    const handleMessage = (event) => {
      const { type, score, roomId, roundId } = event.data || {};
      if (type !== 'GAME_OVER') return;

      const resolvedRoundId = roundId || activeRoundIdRef.current;
      if (!resolvedRoundId || !walletAddress) return;

      const token = localStorage.getItem('token');
      fetch(buildApiUrl('/intraverse/game-point'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          roundId: resolvedRoundId,
          roomId: roomId || `warzone-${Date.now()}`,
          score: Number(score) || 0,
          walletAddress,
        }),
      })
        .then((r) => r.json())
        .then((data) => console.log('[intraverse] score submitted:', data))
        .catch((err) => console.error('[intraverse] score submit failed:', err));
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [walletAddress]);

  const GAME_BASE_URL = import.meta.env.VITE_CLOUDFLARE_R2_GAME_URL || 'https://warzonewarriors.xyz/game';

  // Build game URL — walletAddress + jwt so Unity's Root.cs can authenticate
  const buildGameUrl = useCallback((jwt: string | null) => {
    if (!walletAddress) return GAME_BASE_URL;
    let url = `${GAME_BASE_URL}?walletAddress=${encodeURIComponent(walletAddress)}`;
    const token = jwt || localStorage.getItem(ZG_JWT_KEY);
    if (token) url += `&jwt=${encodeURIComponent(token)}`;
    return url;
  }, [walletAddress, GAME_BASE_URL]);

  const [gameUrl, setGameUrl] = useState(() => buildGameUrl(null));

  /* ── Fullscreen ──────────────────────────────────────────────────────────── */

  const requestFullscreen = useCallback(async () => {
    const el = containerRef.current;
    if (!el) return;
    try {
      if (el.requestFullscreen)            await el.requestFullscreen();
      else if (el.webkitRequestFullscreen) await el.webkitRequestFullscreen();
      else if (el.mozRequestFullScreen)    await el.mozRequestFullScreen();
      else if (el.msRequestFullscreen)     await el.msRequestFullscreen();
      else if (iframeRef.current?.requestFullscreen) await iframeRef.current.requestFullscreen();
    } catch (e) {
      console.warn('Fullscreen request failed:', e);
    }
  }, []);

  const exitFullscreen = useCallback(async () => {
    try {
      if (document.exitFullscreen)            await document.exitFullscreen();
      else if (document.webkitExitFullscreen) await document.webkitExitFullscreen();
      else if (document.mozCancelFullScreen)  await document.mozCancelFullScreen();
      else if (document.msExitFullscreen)     await document.msExitFullscreen();
    } catch (e) {
      console.warn('Exit fullscreen failed:', e);
    }
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (isFullscreen) exitFullscreen();
    else              requestFullscreen();
  }, [isFullscreen, requestFullscreen, exitFullscreen]);

  useEffect(() => {
    const onChange = () => {
      const fsEl = document.fullscreenElement
        || document.webkitFullscreenElement
        || document.mozFullScreenElement
        || document.msFullscreenElement;
      setIsFullscreen(!!fsEl);
    };
    document.addEventListener('fullscreenchange',       onChange);
    document.addEventListener('webkitfullscreenchange', onChange);
    document.addEventListener('mozfullscreenchange',    onChange);
    document.addEventListener('MSFullscreenChange',     onChange);
    return () => {
      document.removeEventListener('fullscreenchange',       onChange);
      document.removeEventListener('webkitfullscreenchange', onChange);
      document.removeEventListener('mozfullscreenchange',    onChange);
      document.removeEventListener('MSFullscreenChange',     onChange);
    };
  }, []);

  /* ── Access check + 0G auth + show iframe ───────────────────────────────── */

  useEffect(() => {
    if (hasRunRef.current) return;
    if (showRoundPicker) return;
    hasRunRef.current = true;

    if (!isConnected && !walletAddress) {
      alert('Please connect your wallet first');
      navigate('/');
      return;
    }

    let cancelled = false;
    let fallback: ReturnType<typeof setTimeout> | null = null;

    (async () => {
      // Attempt 0G authentication before the iframe opens so the URL carries the JWT.
      // If auth fails for any reason, the game still loads (falls back to legacy API).
      let jwt: string | null = null;
      if (walletAddress) {
        jwt = await doZGAuth(walletAddress);
        if (!cancelled && jwt) setZgJwt(jwt);
      }

      if (!cancelled) {
        setGameUrl(buildGameUrl(jwt));
        setShowIframe(true);
        fallback = setTimeout(() => setIsLoading(false), 6000);
      }
    })();

    return () => {
      cancelled = true;
      if (fallback) clearTimeout(fallback);
    };
  }, [isConnected, walletAddress, navigate, showRoundPicker, doZGAuth, buildGameUrl]);

  const handleRoundSelect = (round) => {
    activeRoundIdRef.current = round.id;
    setSelectedRound(round);
    setShowRoundPicker(false);
    hasRunRef.current = false;
  };

  const handleIframeLoad = () => {
    loadedRef.current = true;
    setIsLoading(false);
  };

  return (
    <div
      ref={containerRef}
      className={`game-page-container${isFullscreen ? ' is-fullscreen' : ''}`}
    >
      <div className="game-image-bg" aria-hidden="true">
        <img src={gameBackground} alt="" className="game-image-bg-content" />
      </div>

      {/* Round picker */}
      {showRoundPicker && (
        <div className="round-picker-overlay">
          <div className="round-picker-card">
            <div className="round-picker-title">Choose Your Round</div>
            <p className="round-picker-subtitle">
              Multiple tournament rounds are active right now. Pick the one you want to play for.
            </p>
            <div className="round-picker-list">
              {openRounds.map((round) => (
                <button
                  key={round.id}
                  type="button"
                  className="wz-btn wz-btn--outline wz-btn--block round-picker-item"
                  onClick={() => handleRoundSelect(round)}
                >
                  <span className="round-picker-name">{round.name || `Round ${round.id}`}</span>
                  <span className="round-picker-arrow">→</span>
                </button>
              ))}
            </div>
            <ThemedBackButton
              className="round-picker-back-button"
              compact
              label="Back"
              onClick={() => navigate('/')}
            />
          </div>
        </div>
      )}

      {/* Loading screen */}
      {!showRoundPicker && isLoading && (
        <div className="loading-background">
          <div className="center-image">
            <img src={centerImage} alt="Warzone Warriors" className="center-image-content" />
          </div>
          <div className="loading-text">Assembling your Arsenal…</div>
        </div>
      )}

      {/* Home button */}
      {showIframe && (
        <button
          type="button"
          className="game-overlay-button game-overlay-button--home"
          onClick={() => navigate('/')}
          aria-label="Home"
          title="Home"
        >
          <Home className="game-overlay-button__icon" />
        </button>
      )}

      {/* Fullscreen toggle */}
      {showIframe && !isFullscreen && (
        <button
          type="button"
          className="game-overlay-button game-overlay-button--fullscreen"
          onClick={toggleFullscreen}
          aria-label="Enter fullscreen"
          title="Fullscreen"
        >
          <Maximize2 className="game-overlay-button__icon" />
        </button>
      )}
      {showIframe && isFullscreen && (
        <button
          type="button"
          className="game-overlay-button game-overlay-button--exit-fs"
          onClick={toggleFullscreen}
          aria-label="Exit fullscreen"
          title="Exit fullscreen"
        >
          <X className="game-overlay-button__icon" />
        </button>
      )}

      {/* Game iframe — URL includes walletAddress + jwt */}
      {showIframe && (
        <div className="game-iframe-wrapper">
          <iframe
            ref={iframeRef}
            src={gameUrl}
            title="Warzone Warriors"
            className={`game-iframe${!isLoading ? ' loaded' : ''}`}
            onLoad={handleIframeLoad}
            onError={() => setIsLoading(false)}
            allow="fullscreen; autoplay; clipboard-read; clipboard-write; encrypted-media; accelerometer; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      )}
    </div>
  );
};

export default Game;
