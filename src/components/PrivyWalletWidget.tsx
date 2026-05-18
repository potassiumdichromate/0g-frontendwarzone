import React, { useEffect, useState, useRef } from 'react';
import { createPublicClient, http, formatEther } from 'viem';
import { usePrivyWalletTools } from '../hooks/usePrivyWalletTools';

const buildChainForViem = (allowedChain) => {
  const rpcUrl =
    (Array.isArray(allowedChain.rpcUrls) && allowedChain.rpcUrls[0]) ||
    'https://evmrpc.0g.ai';

  const nativeCurrency = allowedChain.nativeCurrency || {
    name: '0G',
    symbol: '0G',
    decimals: 18,
  };

  return {
    id: allowedChain.decimalChainId,
    name: allowedChain.chainName || '0G Mainnet',
    nativeCurrency,
    rpcUrls: {
      default: { http: [rpcUrl] },
      public: { http: [rpcUrl] },
    },
  };
};

export const PrivyWalletWidget = () => {
  const {
    canUsePrivy,
    activeWallet,
    allowedChain,
    openPrivyFunding,
  } = usePrivyWalletTools();

  const [balance, setBalance] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);
  const [refreshTick, setRefreshTick] = useState(0);
  const [dragPosition, setDragPosition] = useState(null);
  const [viewportWidth, setViewportWidth] = useState(
    typeof window !== 'undefined' ? window.innerWidth : 0
  );
  const [mobileFundsOpen, setMobileFundsOpen] = useState(false);
  const dragStateRef = useRef({
    isDragging: false,
    offsetX: 0,
    offsetY: 0,
  });
  const containerRef = useRef(null);

  useEffect(() => {
    let cancelled = false;

    const loadBalance = async () => {
      if (!canUsePrivy || !activeWallet?.address || !allowedChain?.decimalChainId) {
        setBalance(null);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        const chain = buildChainForViem(allowedChain);
        const client = createPublicClient({
          chain,
          transport: http(
            chain.rpcUrls.default.http[0] || 'https://evmrpc.0g.ai'
          ),
        });

        const raw = await client.getBalance({ address: activeWallet.address });
        if (cancelled) return;

        const value = Number(formatEther(raw));
        const formatted = Number.isFinite(value)
          ? value.toLocaleString(undefined, {
              maximumFractionDigits: 4,
            })
          : null;

        setBalance(formatted);
      } catch (err) {
        if (cancelled) return;
        console.error('Failed to load Privy wallet balance:', err);
        setError('Balance unavailable');
        setBalance(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadBalance();
    return () => {
      cancelled = true;
    };
  }, [canUsePrivy, activeWallet, allowedChain, refreshTick]);

  useEffect(() => {
    const handleResize = () => {
      if (typeof window === 'undefined') return;
      setViewportWidth(window.innerWidth);
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const handleMouseMove = (event) => {
      if (!dragStateRef.current.isDragging || !containerRef.current) return;

      const node = containerRef.current;
      const rect = node.getBoundingClientRect();
      const width = rect.width;
      const height = rect.height;

      let nextX = event.clientX - dragStateRef.current.offsetX;
      let nextY = event.clientY - dragStateRef.current.offsetY;

      const maxX = window.innerWidth - width;
      const maxY = window.innerHeight - height;

      if (nextX < 0) nextX = 0;
      if (nextY < 0) nextY = 0;
      if (nextX > maxX) nextX = maxX;
      if (nextY > maxY) nextY = maxY;

      setDragPosition({ x: nextX, y: nextY });
    };

    const handleMouseUp = () => {
      dragStateRef.current.isDragging = false;
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  const isMobileLayout = viewportWidth <= 768;

  useEffect(() => {
    if (!isMobileLayout && mobileFundsOpen) {
      setMobileFundsOpen(false);
    }
  }, [isMobileLayout, mobileFundsOpen]);

  if (!canUsePrivy || !activeWallet?.address) {
    return null;
  }

  const shortAddress = `${activeWallet.address.slice(0, 6)}...${activeWallet.address.slice(-4)}`;
  const symbol = allowedChain?.nativeCurrency?.symbol || '0G';

  const handleDragStart = (event) => {
    // On small mobile widths, keep the widget locked
    if (viewportWidth <= 450) return;
    if (event.button !== 0) return;
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    dragStateRef.current.isDragging = true;
    dragStateRef.current.offsetX = event.clientX - rect.left;
    dragStateRef.current.offsetY = event.clientY - rect.top;
    event.preventDefault();
  };

  const handleCopyAddress = async () => {
    if (!activeWallet?.address) return;
    try {
      if (navigator && navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(activeWallet.address);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = activeWallet.address;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (err) {
      console.error('Failed to copy address:', err);
      alert('Could not copy address. Please copy it manually.');
    }
  };

  const handleAddFunds = async () => {
    try {
      await openPrivyFunding();
    } catch (err: unknown) {
      console.error('Failed to open Privy funding:', err);
      const message =
        err instanceof Error
          ? err.message
          : 'Wallet funding is not enabled for this project. Please configure funding in your Privy dashboard.';
      alert(message);
    }
  };

  const dragStyle =
    dragPosition && viewportWidth > 450
      ? {
          top: dragPosition.y,
          left: dragPosition.x,
          right: 'auto',
          bottom: 'auto',
          transform: 'none',
        }
      : {};

  const handleRefreshClick = (event) => {
    event.stopPropagation();
    if (loading) return;
    setRefreshTick((prev) => prev + 1);
  };

  const walletDetails = (
    <>
      <div className="privy-wallet-row">
        <span className="label">Address</span>
        <button
          type="button"
          className="wz-btn wz-btn--sm wz-btn--outline privy-copy-button"
          onClick={handleCopyAddress}
          title={activeWallet.address}
        >
          <span className="value">{shortAddress}</span>
          <span className="privy-copy-pill">
            {copied ? 'Copied' : 'Copy'}
          </span>
        </button>
      </div>
      <div className="privy-wallet-row">
        <span className="label">Balance</span>
        <span className="value">
          {loading ? 'Loading…' : balance != null ? `${balance} ${symbol}` : error || '--'}
        </span>
      </div>
    </>
  );

  if (isMobileLayout) {
    return (
      <>
        <div className="privy-wallet-mobile-bar">
          <button
            type="button"
            className="wz-btn wz-btn--sm wz-btn--outline privy-mobile-trigger"
            onClick={() => setMobileFundsOpen(true)}
          >
            My Funds
          </button>
          <button
            type="button"
            className="wz-btn wz-btn--sm wz-btn--primary privy-mobile-add-funds"
            onClick={handleAddFunds}
          >
            Add Funds
          </button>
        </div>

        {mobileFundsOpen && (
          <div className="privy-wallet-modal-overlay" onClick={() => setMobileFundsOpen(false)}>
            <div className="privy-wallet-modal" onClick={(event) => event.stopPropagation()}>
              <div className="privy-wallet-header">
                <span className="privy-wallet-title">My Funds</span>
                <button
                  type="button"
                  className="wz-btn wz-btn--sm wz-btn--ghost privy-refresh-button"
                  onClick={handleRefreshClick}
                  disabled={loading}
                >
                  {loading ? 'Refreshing…' : 'Refresh'}
                </button>
              </div>
              {walletDetails}
              <div className="privy-wallet-modal-actions">
                <button
                  type="button"
                  className="wz-btn wz-btn--sm wz-btn--outline"
                  onClick={() => setMobileFundsOpen(false)}
                >
                  Close
                </button>
                <button
                  type="button"
                  className="wz-btn wz-btn--sm wz-btn--primary"
                  onClick={handleAddFunds}
                >
                  Add Funds
                </button>
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  return (
    <div ref={containerRef} className="privy-wallet-widget" style={dragStyle}>
      <div
        className="privy-wallet-header"
        onMouseDown={handleDragStart}
      >
        <span className="privy-wallet-title">My Funds</span>
        <button
          type="button"
          className="wz-btn wz-btn--sm wz-btn--ghost privy-refresh-button"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={handleRefreshClick}
          disabled={loading}
        >
          {loading ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>
      {walletDetails}
      <button
        type="button"
        className="wz-btn wz-btn--sm wz-btn--primary wz-btn--block privy-add-funds-button"
        onClick={handleAddFunds}
      >
        Add Funds
      </button>
    </div>
  );
};

export default PrivyWalletWidget;
