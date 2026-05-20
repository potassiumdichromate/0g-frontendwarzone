import { useState, useRef, useEffect, useCallback, type FormEvent } from 'react';
import './GamePage.css';
import './Game2Page.css';
import { useNavigate } from 'react-router-dom';
import { useWallet } from '../../contexts/WalletContext';
import { buildApiUrl } from '../../config/api';
import { Home, Maximize2, MessageCircle, X } from 'lucide-react';
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
    return Date.now() >= (payload.exp * 1000) - 5 * 60 * 1000;
  } catch {
    return true;
  }
}

type ChatMsg = { id: string; text: string; self: boolean; at: string };

export const Game2 = () => {
  const [isLoading, setIsLoading]   = useState(true);
  const [showIframe, setShowIframe] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [zgJwt, setZgJwt] = useState<string | null>(null);
  const [chatInput, setChatInput] = useState('');
  const [chatMessages, setChatMessages] = useState<ChatMsg[]>([]);

  const loadedRef  = useRef(false);
  const iframeRef  = useRef<HTMLIFrameElement | null>(null);
  const containerRef = useRef(null);
  const hasRunRef  = useRef(false);
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  const navigate = useNavigate();
  const { isConnected, address } = useWallet();
  const { signMessageAsync } = useSignMessage();

  const walletAddress = address || localStorage.getItem('walletAddress');
  const activeRoundIdRef = useRef(null);

  // ── 0G SIWE auth ─────────────────────────────────────────────────────────

  const doZGAuth = useCallback(async (wallet: string): Promise<string | null> => {
    const cached = localStorage.getItem(ZG_JWT_KEY);
    if (cached && !isJwtExpired(cached)) return cached;

    try {
      const nonceRes = await fetch(`${ZG_BACKEND}/auth/nonce?wallet=${encodeURIComponent(wallet)}`);
      if (!nonceRes.ok) throw new Error(`Nonce fetch failed: ${nonceRes.status}`);
      const { nonce, message } = await nonceRes.json();

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
      console.warn('[Game2] 0G auth skipped (non-fatal):', (err as Error).message);
      return null;
    }
  }, [signMessageAsync]);

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

  const GAME_BASE_URL =
    import.meta.env.VITE_CLOUDFLARE_R2_GAME_URL ||
    'https://pub-2c48e58780b648b7a2a77316f7b0aa2c.r2.dev/AIvsAI/WarzoneV2/index.html';

  const buildGameUrl = useCallback((jwt: string | null) => {
    if (!walletAddress) return GAME_BASE_URL;
    const sep = GAME_BASE_URL.includes('?') ? '&' : '?';
    let url = `${GAME_BASE_URL}${sep}walletAddress=${encodeURIComponent(walletAddress)}`;
    const token = jwt || localStorage.getItem(ZG_JWT_KEY);
    if (token) url += `&jwt=${encodeURIComponent(token)}`;
    return url;
  }, [walletAddress, GAME_BASE_URL]);

  const [gameUrl, setGameUrl] = useState(() => buildGameUrl(null));

  // ── Chat ──────────────────────────────────────────────────────────────────

  const appendChat = useCallback((text: string, self: boolean) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    const at = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setChatMessages((prev) => [...prev, { id: `${Date.now()}-${Math.random()}`, text: trimmed, self, at }]);
    setChatInput('');
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

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

    let cancelled = false;
    let fallback: ReturnType<typeof setTimeout> | null = null;

    (async () => {
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
  }, [isConnected, walletAddress, navigate, doZGAuth, buildGameUrl]);

  const handleIframeLoad = () => {
    loadedRef.current = true;
    setIsLoading(false);
  };

  const onChatSubmit = (e: FormEvent) => {
    e.preventDefault();
    appendChat(chatInput, true);
  };

  return (
    <div
      ref={containerRef}
      className={`game-page-container game2-page${isFullscreen ? ' is-fullscreen' : ''}`}
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

      {showIframe && (
        <div className="game2-split">
          <div className="game2-game">
            <button
              type="button"
              className="game-overlay-button game-overlay-button--home"
              onClick={() => navigate('/')}
              aria-label="Home"
              title="Home"
            >
              <Home className="game-overlay-button__icon" />
            </button>

            {!isFullscreen && (
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
            {isFullscreen && (
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
          </div>

          <aside className="game2-chat" aria-label="Game chat">
            <div className="game2-chat-header">
              <MessageCircle size={18} color="#ecc94b" aria-hidden />
              <h2 className="game2-chat-title">Squad chat</h2>
              <span className="game2-chat-badge">Local</span>
            </div>
            <div className="game2-chat-messages" role="log" aria-live="polite">
              {chatMessages.length === 0 ? (
                <p className="game2-chat-empty">
                  Messages stay on this device for now. Say hi to your squad — wire this panel to your backend when ready.
                </p>
              ) : (
                chatMessages.map((m) => (
                  <div
                    key={m.id}
                    className={`game2-chat-msg${m.self ? ' game2-chat-msg--self' : ''}`}
                  >
                    <div className="game2-chat-msg-meta">{m.self ? 'You' : 'Squad'} · {m.at}</div>
                    <div className="game2-chat-msg-body">{m.text}</div>
                  </div>
                ))
              )}
              <div ref={chatEndRef} />
            </div>
            <form className="game2-chat-form" onSubmit={onChatSubmit}>
              <textarea
                className="game2-chat-input"
                rows={1}
                placeholder="Type a message…"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    appendChat(chatInput, true);
                  }
                }}
              />
              <button
                type="submit"
                className="game2-chat-send"
                disabled={!chatInput.trim()}
              >
                Send
              </button>
            </form>
          </aside>
        </div>
      )}
    </div>
  );
};

export default Game2;
