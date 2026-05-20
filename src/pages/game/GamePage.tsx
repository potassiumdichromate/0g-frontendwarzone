import { useState, useRef, useEffect, useCallback } from 'react';
import './GamePage.css';
import { useNavigate } from 'react-router-dom';
import { useWallet } from '../../contexts/WalletContext';
import { HARDCODED_TOURNAMENTS } from '../../constants/tournaments';
import { Home, Maximize2, X } from 'lucide-react';
import centerImage from "../../assets/images/abc1.png";
import gameBackground from '../../assets/hero-web3.png';
import ThemedBackButton from '../../components/ThemedBackButton';

export const Game = () => {
  const [isLoading, setIsLoading]   = useState(true);
  const [showIframe, setShowIframe] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [openRounds, setOpenRounds]   = useState([]);   // rounds with active intervals
  const [selectedRound, setSelectedRound] = useState(null); // { id, name }
  const [showRoundPicker, setShowRoundPicker] = useState(false);

  const loadedRef  = useRef(false);
  const iframeRef  = useRef(null);
  const containerRef = useRef(null);
  const hasRunRef  = useRef(false);

  const navigate = useNavigate();
  const { isConnected, address } = useWallet();

  const walletAddress = address || localStorage.getItem('walletAddress');
  const activeRoundIdRef = useRef(null);

  // Returns all rounds whose interval window contains right now,
  // plus a single fallback if none are open.
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

    if (open.length > 0) {
      console.log('[intraverse] open rounds by interval:', open.map((r) => r.id));
      return open;
    }

    // No interval open right now — fall back to first round
    const fallback = tournament.rounds[0];
    if (fallback) {
      console.log('[intraverse] no open interval, fallback roundId:', fallback.id);
      return [fallback];
    }
    return [];
  }

  useEffect(() => {
    const rounds = resolveOpenRounds(HARDCODED_TOURNAMENTS);
    if (rounds.length === 1) {
      activeRoundIdRef.current = rounds[0].id;
      setSelectedRound(rounds[0]);
    } else if (rounds.length > 1) {
      setOpenRounds(rounds);
      setShowRoundPicker(true);
    }
  }, []);

  // Listen for GAME_OVER postMessage from the game iframe and submit score
  useEffect(() => {
    const handleMessage = (event) => {
      const { type, score, roomId, roundId } = event.data || {};
      if (type !== 'GAME_OVER') return;

      const resolvedRoundId = roundId || activeRoundIdRef.current;
      if (!resolvedRoundId) {
        console.warn('[intraverse] GAME_OVER: no roundId available');
        return;
      }
      if (!walletAddress) {
        console.warn('[intraverse] GAME_OVER: no walletAddress available');
        return;
      }

      console.log('[game] GAME_OVER score (local only, no tournament API):', {
        roundId: resolvedRoundId,
        roomId: roomId || `warzone-${Date.now()}`,
        score: Number(score) || 0,
        walletAddress,
      });
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [walletAddress]);
  const GAME_BASE_URL = import.meta.env.VITE_CLOUDFLARE_R2_GAME_URL || 'https://warzonewarriors.xyz/game';
  const gameUrl = walletAddress
    ? `${GAME_BASE_URL}?walletAddress=${encodeURIComponent(walletAddress)}`
    : GAME_BASE_URL;

  /* ── Fullscreen logic — works on all browsers + iOS workaround ── */
  const requestFullscreen = useCallback(async () => {
    const el = containerRef.current;
    if (!el) return;
    try {
      if (el.requestFullscreen)            await el.requestFullscreen();
      else if (el.webkitRequestFullscreen) await el.webkitRequestFullscreen();
      else if (el.mozRequestFullScreen)    await el.mozRequestFullScreen();
      else if (el.msRequestFullscreen)     await el.msRequestFullscreen();
      // iOS Safari doesn't support Fullscreen API — fall back to locking orientation
      else if (iframeRef.current?.requestFullscreen) {
        await iframeRef.current.requestFullscreen();
      }
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

  /* Track fullscreen state changes from browser UI (e.g. Escape key) */
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

  /* ── Access check + show iframe ── */
  useEffect(() => {
    if (hasRunRef.current) return;
    // Don't start until round picker (if needed) is resolved
    if (showRoundPicker) return;
    hasRunRef.current = true;

    if (!isConnected && !walletAddress) {
      alert('Please connect your wallet first');
      navigate('/');
      return;
    }

    setShowIframe(true);

    // Fallback: remove loading screen after 6s if iframe onLoad never fires
    const fallback = setTimeout(() => setIsLoading(false), 6000);
    return () => clearTimeout(fallback);
  }, [isConnected, walletAddress, navigate, showRoundPicker]);

  const handleRoundSelect = (round) => {
    activeRoundIdRef.current = round.id;
    setSelectedRound(round);
    setShowRoundPicker(false);
    // Reset hasRunRef so the access-check effect fires now that picker is dismissed
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
      {/* Round picker — shown when multiple rounds are simultaneously active */}
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

      {/* Home — top-right, 2 icon-widths from the edge */}
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

      {/* Fullscreen — bottom-right; in fullscreen mode → close icon at top-center */}
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

      {/* Game iframe — full container */}
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
