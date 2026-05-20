import { useState, useRef, useEffect, useCallback, type FormEvent } from 'react';
import './GamePage.css';
import './Game2Page.css';
import { useNavigate } from 'react-router-dom';
import { useWallet } from '../../contexts/WalletContext';
import { HARDCODED_TOURNAMENTS } from '../../constants/tournaments';
import { Home, Maximize2, MessageCircle, X } from 'lucide-react';
import centerImage from "../../assets/images/abc1.png";
import gameBackground from '../../assets/hero-web3.png';
import ThemedBackButton from '../../components/ThemedBackButton';

export const Game2 = () => {
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
  const GAME_BASE_URL =
    import.meta.env.VITE_CLOUDFLARE_R2_GAME_URL ||
    'https://pub-2c48e58780b648b7a2a77316f7b0aa2c.r2.dev/AIvsAI/WarzoneV2/index.html';
  const gameUrl = walletAddress
    ? `${GAME_BASE_URL}${GAME_BASE_URL.includes('?') ? '&' : '?'}walletAddress=${encodeURIComponent(walletAddress)}`
    : GAME_BASE_URL;

  type ChatMsg = { id: string; text: string; self: boolean; at: string };
  const [chatInput, setChatInput] = useState('');
  const [chatMessages, setChatMessages] = useState<ChatMsg[]>([]);
  const chatEndRef = useRef<HTMLDivElement | null>(null);

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
