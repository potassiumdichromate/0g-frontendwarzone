import { useState, useRef, useEffect, useCallback } from 'react';
import './GamePage.css';
import { useNavigate } from 'react-router-dom';
import { useWallet } from '../../contexts/WalletContext';
import { buildApiUrl } from '../../config/api';
import { Home, Maximize2, X } from 'lucide-react';
import centerImage from "../../assets/images/abc1.png";
import gameBackground from '../../assets/hero-web3.png';

const ZG_JWT_KEY = 'ZGJwt';

function getCachedJwt(): string | null {
  try {
    const token = localStorage.getItem(ZG_JWT_KEY);
    if (!token) return null;
    const payload = JSON.parse(atob(token.split('.')[1]));
    return Date.now() < (payload.exp * 1000) - 5 * 60 * 1000 ? token : null;
  } catch {
    return null;
  }
}

export const Game = () => {
  const [isLoading, setIsLoading]   = useState(true);
  const [showIframe, setShowIframe] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [zgJwt, setZgJwt] = useState<string | null>(getCachedJwt);

  const loadedRef  = useRef(false);
  const iframeRef  = useRef(null);
  const containerRef = useRef(null);
  const hasRunRef  = useRef(false);

  const navigate = useNavigate();
  const { isConnected, address } = useWallet();


  const walletAddress = address || localStorage.getItem('walletAddress');
  const activeRoundIdRef = useRef(null);

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
    hasRunRef.current = true;

    if (!isConnected && !walletAddress) {
      alert('Please connect your wallet first');
      navigate('/');
      return;
    }

    // Use cached JWT only — never block on a signature request here
    const jwt = getCachedJwt();
    if (jwt) setZgJwt(jwt);
    setGameUrl(buildGameUrl(jwt));
    setShowIframe(true);
    const fallback = setTimeout(() => setIsLoading(false), 6000);
    return () => clearTimeout(fallback);
  }, [isConnected, walletAddress, navigate, buildGameUrl]);

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

      {/* Loading screen */}
      {isLoading && (
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
