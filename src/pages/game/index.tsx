import React, { useState, useRef, useEffect } from 'react';
import './style.css';
import { useNavigate } from 'react-router-dom';
import { useWallet } from '../../contexts/WalletContext';
import centerImage from "../../assets/images/abc1.png";
import topRightImage from "../../assets/images/Frame 74.png";
import topRightAdditionalImage from "../../assets/images/image 32.png";

const GAME_BASE_URL = 'https://warzonewarriors.xyz/game';
const ZG_JWT_KEY = 'ZGJwt';

function buildGameUrl(walletAddress: string | null): string {
  if (!walletAddress) return GAME_BASE_URL;
  let url = `${GAME_BASE_URL}?walletAddress=${encodeURIComponent(walletAddress)}`;
  const jwt = localStorage.getItem(ZG_JWT_KEY);
  if (jwt) url += `&jwt=${encodeURIComponent(jwt)}`;
  return url;
}

export const Game = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [showIframe, setShowIframe] = useState(false);
  const [iframeFailed, setIframeFailed] = useState(false);
  const loadedRef = useRef(false);
  const iframeRef = useRef(null);
  const navigate = useNavigate();
  const { isConnected, checkNFTOwnership, address } = useWallet();
  const hasRunRef = useRef(false);

  const walletAddress = address || localStorage.getItem('walletAddress');

  const log = (...args) => console.log('[Game]', new Date().toISOString(), ...args);

  useEffect(() => {
    log('mount/useEffect start', { isConnected, walletAddress });
    const verifyAccess = async () => {
      if (!isConnected && !walletAddress) {
        log('not connected -> redirect home');
        alert('Please connect your wallet first');
        navigate('/');
        return;
      }
      setShowIframe(true);
      log('setShowIframe(true)');

      try {
        await checkNFTOwnership(walletAddress);
        log('background NFT check invoked');
      } catch (err) {
        console.warn('[Game]', 'Non-fatal: NFT check failed.', err);
      }

      const fallback = setTimeout(() => {
        log('fallback fired (6000ms)', { loaded: loadedRef.current });
        if (!loadedRef.current) setIframeFailed(true);
        setIsLoading(false);
      }, 6000);
      log('fallback timer set (6000ms)');

      return () => clearTimeout(fallback);
    };

    if (hasRunRef.current) { log('effect already ran, skipping'); return; }
    hasRunRef.current = true;
    verifyAccess();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleIframeLoad = () => {
    loadedRef.current = true;
    log('iframe onLoad');
    setIsLoading(false);
    setIframeFailed(false);
  };

  const gameUrl = buildGameUrl(walletAddress);

  return (
    <div className="game-container">
      {isLoading && (
        <div className="loading-background" style={{display:'flex'}}>
          <div className="center-image">
            <img
              src={centerImage}
              alt="Game Center Piece"
              className="center-image-content"
            />
          </div>
          <div className="center-image-content" style={{maxWidth:'200px',width:"100%",textAlign:'right',fontSize:'40px',fontWeight:'bold',marginRight:'10px',marginBottom:"50px"}}>
            Loading ...
          </div>
          <div className="top-right-container">
            <div className="top-right-image">
              <img
                src={topRightImage}
                alt="Top Right Decoration"
                className="top-image"
              />
            </div>
            <div className="top-right-additional">
              <img
                src={topRightAdditionalImage}
                alt="Additional Decoration"
                className="top-image"
              />
            </div>
          </div>
        </div>
      )}

      {showIframe && (
        <iframe
          ref={iframeRef}
          src={gameUrl}
          title="Game Content"
          className={`game-iframe ${!isLoading ? 'loaded' : ''}`}
          onLoad={handleIframeLoad}
          onError={() => { log('iframe onError'); setIframeFailed(true); setIsLoading(false); }}
          allow="fullscreen; autoplay; clipboard-read; clipboard-write; encrypted-media; accelerometer; gyroscope; picture-in-picture"
          allowFullScreen
        />
      )}

      <div className={`game-buttons ${!isLoading ? 'hidden' : ''}`} />
    </div>
  );
};

export default Game;
