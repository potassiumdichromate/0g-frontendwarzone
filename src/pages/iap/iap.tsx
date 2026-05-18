import React, { useEffect, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import c1Image from '../../assets/images/c1.png';
import c2Image from '../../assets/images/c2.png';
import c3Image from '../../assets/images/c3.png';
import c4Image from '../../assets/images/c4.png';
import gemsSmallImage from '../../assets/images/gems-small-clean.png';
import gemsLargeImage from '../../assets/images/gems-large-clean.png';
import gemsChestImage from '../../assets/images/gems-chest-clean.png';
import gunAwpImage from '../../assets/images/gun-awp-clean.png';
import gunBullpupImage from '../../assets/images/gun-bullpup-clean.png';
import gunShotgunImage from '../../assets/images/gun-shotgun-clean.png';
import gunSniperRifleImage from '../../assets/images/gun-sniper-rifle-clean.png';
import coin100Image from '../../assets/images/100-coins.png';
import coin500Image from '../../assets/images/500-coins.png';
import coin1000Image from '../../assets/images/1000-coins.png';
import coin2000Image from '../../assets/images/2000-coins.png';
import gunTeslaMiniImage from '../../assets/images/gun-tesla-mini-clean.png';
import gunScarHImage from '../../assets/images/gun-scar-h-clean.png';
import gun100Image from '../../assets/images/gun100.png';
import gun101Image from '../../assets/images/gun101.png';
import gun102Image from '../../assets/images/gun102.png';
import gun103Image from '../../assets/images/gun103.png';
import gun104Image from '../../assets/images/gun104.png';
import gun105Image from '../../assets/images/gun105.png';
import gun106Image from '../../assets/images/gun106.png';
import gun107Image from '../../assets/images/gun107.png';
import gun108Image from '../../assets/images/gun108.png';
import './iap.css';
import { getMarketplacePurchaseStatus, getPlayerProfile, updateMarketplaceData } from '../../utils/api';
import { useAccount, useChainId, useWaitForTransactionReceipt, useWalletClient } from 'wagmi';
import { useWallet } from '../../contexts/WalletContext';
import { zgChain } from '../../wagmi.config';
import { getAllowedChainFromEnv } from '../../lib/chain';
import { encodeFunctionData, keccak256, parseEther, stringToBytes } from 'viem';
import contractAbi from '../../abi/WarzoneInAppPurchase.json';
import { usePrivyWalletTools } from '../../hooks/usePrivyWalletTools';
import MobileBottomNav from '../../components/MobileBottomNav';
import IapMarketplaceLayout from './IapMarketplaceLayout';
import type { IapMarketDisplayItem, IapMarketCategory } from './IapMarketplaceLayout';

// Simple price map for Guns (0G)
const GUN_PRICES_ETH = {
  'Shotgun': '0.8',
  'Bullpup': '1.6',
  'ScarH': '2',
  'Sniper Rifle': '2.4',
  'Tesla Mini': '3',
  'AWP': '4',
  'Spread': '5',
  'Chaser': '6',
  'Famas': '7',
  'Laser': '8',
  'Split': '9',
  'Fireball': '10',
  'Tesla': '12',
  'Kame Power': '13',
  'Flame Thrower': '15',
};

const GUN_IDS = {
  'ScarH': 2,
  'AWP': 3,
  'Shotgun': 4,
  'Bullpup': 6,
  'Sniper Rifle': 7,
  'Tesla Mini': 8,
  'Spread': 100,
  'Chaser': 101,
  'Famas': 102,
  'Laser': 103,
  'Split': 104,
  'Fireball': 105,
  'Tesla': 106,
  'Kame Power': 107,
  'Flame Thrower': 108,
};

const GUN_NAME_BY_ID = Object.fromEntries(
  Object.entries(GUN_IDS).map(([name, id]) => [String(id), name])
);

// Price maps for Coins and Gems (0G)
const COIN_PRICES_ETH = {
  '100': '0.5',
  '500': '2',
  '1000': '4',
  '2000': '7.5',
};

const GEM_PRICES_ETH = {
  '100': '0.5',
  '300': '1.5',
  '500': '2.5',
  '1000': '5',
};

const RARITY_CYCLE = ['COMMON', 'UNCOMMON', 'RARE', 'EPIC', 'LEGENDARY', 'MYTHIC'] as const;

const IAP_COINS_DATA = [
  { id: 1, image: c1Image, detailImage: coin100Image, name: '100 Coins', value: '100', type: 'Coins' as const },
  { id: 2, image: c2Image, detailImage: coin500Image, name: '500 Coins', value: '500', type: 'Coins' as const },
  { id: 3, image: c3Image, detailImage: coin1000Image, name: '1000 Coins', value: '1000', type: 'Coins' as const },
  { id: 4, image: c4Image, detailImage: coin2000Image, name: '2000 Coins', value: '2000', type: 'Coins' as const },
];

const IAP_GEMS_DATA = [
  { id: 1, image: gemsSmallImage, detailImage: gemsSmallImage, name: '100 Gems', value: '100', type: 'Gems' as const },
  { id: 2, image: gemsSmallImage, detailImage: gemsSmallImage, name: '300 Gems', value: '300', type: 'Gems' as const },
  { id: 3, image: gemsLargeImage, detailImage: gemsLargeImage, name: '500 Gems', value: '500', type: 'Gems' as const },
  { id: 4, image: gemsChestImage, detailImage: gemsChestImage, name: '1000 Gems', value: '1000', type: 'Gems' as const },
];

const IAP_GUNS_DATA = [
  { id: 1, image: gunSniperRifleImage , detailImage: gunSniperRifleImage , name: 'AWP', value: 'AWP', type: 'Guns' as const },
  { id: 2, image: gunBullpupImage, detailImage: gunBullpupImage, name: 'Bullpup', value: 'Bullpup', type: 'Guns' as const },
  { id: 3, image: gunShotgunImage, detailImage: gunShotgunImage, name: 'Shotgun', value: 'Shotgun', type: 'Guns' as const },
  { id: 4, image: gunAwpImage, detailImage: gunAwpImage, name: 'Sniper Rifle', value: 'Sniper Rifle', type: 'Guns' as const },
  { id: 5, image: gunTeslaMiniImage, detailImage: gunTeslaMiniImage, name: 'Tesla Mini', value: 'Tesla Mini', type: 'Guns' as const },
  { id: 6, image: gunScarHImage, detailImage: gunScarHImage, name: 'ScarH', value: 'ScarH', type: 'Guns' as const },
  { id: 100, image: gun100Image, detailImage: gun100Image, name: 'Spread', value: 'Spread', type: 'Guns' as const },
  { id: 101, image: gun101Image, detailImage: gun101Image, name: 'Chaser', value: 'Chaser', type: 'Guns' as const },
  { id: 102, image: gun102Image, detailImage: gun102Image, name: 'Famas', value: 'Famas', type: 'Guns' as const },
  { id: 103, image: gun103Image, detailImage: gun103Image, name: 'Laser', value: 'Laser', type: 'Guns' as const },
  { id: 104, image: gun104Image, detailImage: gun104Image, name: 'Split', value: 'Split', type: 'Guns' as const },
  { id: 105, image: gun105Image, detailImage: gun105Image, name: 'Fireball', value: 'Fireball', type: 'Guns' as const },
  { id: 106, image: gun106Image, detailImage: gun106Image, name: 'Tesla', value: 'Tesla', type: 'Guns' as const },
  { id: 107, image: gun107Image, detailImage: gun107Image, name: 'Kame Power', value: 'Kame Power', type: 'Guns' as const },
  { id: 108, image: gun108Image, detailImage: gun108Image, name: 'Flame Thrower', value: 'Flame Thrower', type: 'Guns' as const },
];

function buildItemsByCategory(ownedGuns: string[]): Record<IapMarketCategory, IapMarketDisplayItem[]> {
  const gunOwned = (v: string) => ownedGuns.includes(String(v));
  const coins = IAP_COINS_DATA.map((item, i) => ({
    id: item.id,
    name: item.name,
    amountLabel: `${item.value} coins`,
    priceNumeric: COIN_PRICES_ETH[item.value as keyof typeof COIN_PRICES_ETH] ?? '—',
    rarity: RARITY_CYCLE[i % RARITY_CYCLE.length],
    popular: item.value === '500' || item.value === '1000',
    image: item.image,
    detailImage: item.detailImage,
    iapType: item.type,
    iapValue: item.value,
    owned: false,
  }));
  const gems = IAP_GEMS_DATA.map((item, i) => ({
    id: item.id,
    name: item.name,
    amountLabel: `${item.value} gems`,
    priceNumeric: GEM_PRICES_ETH[item.value as keyof typeof GEM_PRICES_ETH] ?? '—',
    rarity: RARITY_CYCLE[i % RARITY_CYCLE.length],
    popular: item.value === '300' || item.value === '500',
    image: item.image,
    detailImage: item.detailImage,
    iapType: item.type,
    iapValue: item.value,
    owned: false,
  }));
  const guns = IAP_GUNS_DATA.map((item, i) => ({
    id: item.id,
    name: item.name,
    amountLabel: 'Weapon unlock',
    priceNumeric: GUN_PRICES_ETH[item.value as keyof typeof GUN_PRICES_ETH] ?? '—',
    rarity: RARITY_CYCLE[i % RARITY_CYCLE.length],
    popular: item.value === 'Bullpup' || item.value === 'Sniper Rifle',
    image: item.image,
    detailImage: item.detailImage,
    iapType: item.type,
    iapValue: item.value,
    owned: gunOwned(item.value),
  }));
  return { coins, gems, guns };
}

const CoinDetail = ({ coinImage, onClose, type, value, onPurchased }) => {
  const { isConnected: wagmiConnected, address: wagmiAddr } = useAccount();
  const { isConnected: walletCtxConnected, address: walletCtxAddr } = useWallet();
  const isConnected = wagmiConnected || walletCtxConnected;
  const address = wagmiAddr || walletCtxAddr;
  const { data: walletClient } = useWalletClient();
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState(null);
  const [txHash, setTxHash] = useState(undefined);
  const [pendingOrder, setPendingOrder] = useState(null);
  const [purchaseMethod, setPurchaseMethod] = useState<'wallet' | 'privy' | null>(null);
  const { isLoading: isConfirming, isSuccess: isConfirmed, error: waitError } = useWaitForTransactionReceipt({
    hash: txHash,
  });
  const { switchTo0G, refreshProfile } = useWallet();
  const [switchingNetwork, setSwitchingNetwork] = useState(false);
  const {
    privyReady,
    privyAuthenticated,
    canUsePrivy,
    activeWallet,
    wallets: privyWallets,
    sendPrivyTransaction,
    allowedChain,
  } = usePrivyWalletTools();
  const [showSuccess, setShowSuccess] = useState(false);
  const currentChainId = useChainId();

  const contractAddress = import.meta.env.VITE_IAP_CONTRACT_ADDRESS;

  // Use the same allowed chain config as the login flow (LoginModal)
  const effectiveAllowedChain = allowedChain || getAllowedChainFromEnv() || {
    caip2: 'eip155:16661',
    decimalChainId: 16661,
    hexChainId: '0x4115',
    chainName: '0G Mainnet',
    rpcUrls: ['https://evmrpc.0g.ai'],
    blockExplorerUrls: ['https://chainscan.0g.ai'],
  };


  useEffect(() => {
    // After confirmation, call backend to finalize purchase
    const finalize = async () => {
      if (!isConfirmed || !type || !value || !pendingOrder || !txHash || pendingOrder.submitted) {
        return;
      }

      const orderSnapshot = pendingOrder;
      setPendingOrder(prev =>
        prev && prev.orderId === orderSnapshot.orderId ? { ...prev, submitted: true } : prev
      );

      const payload = { type, value, orderId: orderSnapshot.orderId, txHash };

      try {
        const response = await updateMarketplaceData(payload);
        console.log('Purchase accepted:', response);
        void refreshProfile();
        const purchase = response?.data?.purchase || null;
        const isDelivered =
          purchase?.delivered === true || purchase?.status === 'completed';

        // If backend already delivered, cache ownership locally and notify parent
        if (type === 'Guns' && isDelivered) {
          try {
            const addr = localStorage.getItem('walletAddress');
            if (addr) {
              const key = `ownedGuns:${addr.toLowerCase()}`;
              const existing = JSON.parse(localStorage.getItem(key) || '[]');
              if (!existing.includes(String(value))) {
                const updated = [...existing, String(value)];
                localStorage.setItem(key, JSON.stringify(updated));
              }
            }
          } catch (e) {
            console.warn('Failed to update owned guns cache:', e);
          }
          onPurchased?.(value);
        }

        // If delivery is still pending, poll status briefly in background.
        if (!isDelivered && orderSnapshot?.orderId) {
          setTimeout(async () => {
            try {
              const statusResponse = await getMarketplacePurchaseStatus({
                orderId: orderSnapshot.orderId,
                txHash,
              });
              const statusPurchase = statusResponse?.data?.purchase || null;
              const completed =
                statusPurchase?.delivered === true ||
                statusPurchase?.status === 'completed';

              if (completed) {
                void refreshProfile();
              }

              if (type === 'Guns' && completed) {
                const addr = localStorage.getItem('walletAddress');
                if (addr) {
                  const key = `ownedGuns:${addr.toLowerCase()}`;
                  const existing = JSON.parse(localStorage.getItem(key) || '[]');
                  if (!existing.includes(String(value))) {
                    localStorage.setItem(key, JSON.stringify([...existing, String(value)]));
                  }
                }
                onPurchased?.(value);
              }
            } catch (pollErr) {
              console.warn('Purchase status polling failed:', pollErr);
            }
          }, 6000);
        }
      } catch (e) {
        console.error('Failed to finalize purchase:', e);
        setPendingOrder(prev =>
          prev && prev.orderId === orderSnapshot.orderId ? { ...prev, submitted: false } : prev
        );
      }
    };
    finalize();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConfirmed, pendingOrder, type, value, txHash]);

  // Show success popup when the transaction is confirmed
  useEffect(() => {
    if (isConfirmed && txHash) {
      setShowSuccess(true);
    }
  }, [isConfirmed, txHash]);

  // Single purchase handler — uses Privy for everything (MetaMask, Coinbase, embedded wallets).
  // Per https://docs.privy.io/wallets/using-wallets/ethereum/send-a-transaction
  // and https://docs.privy.io/wallets/using-wallets/ethereum/switch-chain
  const handlePurchase = async () => {
    try {
      if (isSending || isConfirming) {
        alert('Please wait for the current transaction to finish.');
        return;
      }

      // Intraverse-only: no wallet provider available
      const isIntraverseOnly = Boolean(localStorage.getItem('intraverseUserId')) && !privyAuthenticated;
      if (isIntraverseOnly) {
        alert('Purchases are not available with Intraverse login. Please log out and sign in with a wallet (MetaMask, Coinbase, etc.) to buy items.');
        return;
      }

      if (!privyReady) {
        alert('Wallet is still loading, please wait.');
        return;
      }

      if (!canUsePrivy || !activeWallet?.address) {
        alert('Please connect a wallet first to make purchases.');
        return;
      }

      if (!contractAddress) {
        alert('Purchase contract address is not configured.');
        return;
      }

      setShowSuccess(false);
      setSendError(null);

      // Guard: prevent purchasing a gun that's already owned
      if (type === 'Guns') {
        try {
          const addr = localStorage.getItem('walletAddress');
          if (addr) {
            const owned = JSON.parse(localStorage.getItem(`ownedGuns:${addr.toLowerCase()}`) || '[]');
            if (owned.includes(String(value))) {
              alert('You already own this gun.');
              return;
            }
          }
        } catch (e) {
          console.warn('Owned guns cache read failed:', e);
        }
      }

      let priceEth;
      if (type === 'Guns') {
        priceEth = GUN_PRICES_ETH[value];
      } else if (type === 'Coins') {
        priceEth = COIN_PRICES_ETH[value];
      } else if (type === 'Gems') {
        priceEth = GEM_PRICES_ETH[value];
      }

      if (!priceEth) {
        alert('Unknown product/price.');
        return;
      }

      // Step 1: Switch to 0G via Privy's wallet.switchChain()
      const privyWallet = Array.isArray(privyWallets) ? privyWallets[0] : null;
      if (privyWallet?.switchChain) {
        try {
          await privyWallet.switchChain(zgChain.id);
        } catch (e: any) {
          if (e?.code === 4001 || /rejected|denied/i.test(e?.message || '')) {
            alert('Please switch to the 0G network to purchase.');
            return;
          }
          console.warn('Chain switch warning (continuing):', e?.message);
        }
      }

      // Step 2: Build transaction
      const orderId =
        (typeof crypto !== 'undefined' && crypto.randomUUID?.()) ||
        `${Date.now()}-${Math.random().toString(16).slice(2)}`;
      const orderHash = keccak256(stringToBytes(orderId));

      setPendingOrder({ orderId, orderHash, submitted: false });
      setPurchaseMethod('privy');
      setIsSending(true);

      const data = encodeFunctionData({
        abi: contractAbi,
        functionName: 'purchase',
        args: [type, value, orderHash],
      });

      const valueWei = parseEther(priceEth);

      // Step 3: Send via Privy's sendTransaction
      // Works for MetaMask, Coinbase, embedded wallets — all through one API
      // value must be a bigint — passing a hex string causes Privy to misread it
      // as a decimal, producing an astronomically large ETH display amount.
      const receipt = await (sendPrivyTransaction as any)(
        {
          to: contractAddress,
          value: valueWei,
          data,
          chainId: zgChain.id,
        },
        {
          address: activeWallet.address,
          uiOptions: { showWalletUIs: true },
        },
      );

      const txHashFromReceipt =
        typeof receipt === 'string'
          ? receipt
          : receipt.transactionHash || receipt.hash;

      if (!txHashFromReceipt) {
        throw new Error('Unable to determine transaction hash');
      }

      setTxHash(txHashFromReceipt);
    } catch (err) {
      setSendError(err);
      setPendingOrder(null);
      setPurchaseMethod(null);
      setTxHash(undefined);
      const msg = err?.shortMessage || err?.message || '';
      const code = err?.code ?? err?.cause?.code;
      console.error('Purchase failed:', err);

      if (code === 4001 || /rejected/i.test(msg)) {
        alert('Transaction rejected in wallet.');
      } else if (/insufficient funds/i.test(msg)) {
        alert('Insufficient 0G for this purchase (including gas).');
      } else if (/chain|network|mismatch/i.test(msg) || err?.name === 'ChainMismatchError') {
        alert('Wrong network selected. Please switch to 0G and try again.');
      } else if (/GunAlreadyPurchased/i.test(msg)) {
        alert('You already own this gun.');
      } else if (/No embedded or connected wallet/i.test(msg)) {
        alert('Wallet not found. Please reconnect your wallet and try again.');
      } else {
        alert(msg || 'Transaction failed. Please try again.');
      }
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="coin-detail-container">
      {showSuccess && (
        <div className="success-modal-overlay">
          <div className="success-modal">
            <div className="success-title">Transaction Successful</div>
            <div className="success-body">
              <div className="success-item-row">
                <span className="label">Item:</span>
                <span className="value">{type} — {value}</span>
              </div>
              <div className="success-item-row">
                <span className="label">Price:</span>
                <span className="value">
                  {type === 'Guns' && GUN_PRICES_ETH[value] ? `${GUN_PRICES_ETH[value]} 0G` : ''}
                  {type === 'Coins' && COIN_PRICES_ETH[value] ? `${COIN_PRICES_ETH[value]} 0G` : ''}
                  {type === 'Gems' && GEM_PRICES_ETH[value] ? `${GEM_PRICES_ETH[value]} 0G` : ''}
                </span>
              </div>
              {pendingOrder?.orderId && (
                <div className="success-item-row">
                  <span className="label">Order Id:</span>
                  <span className="value hash">{pendingOrder.orderId}</span>
                </div>
              )}
              {txHash && (
                <div className="success-item-row">
                  <span className="label">Tx Hash:</span>
                  <span className="value hash">{String(txHash).slice(0, 10)}...{String(txHash).slice(-6)}</span>
                </div>
              )}
            </div>
            <div className="success-actions">
              {txHash && (
                <a
                  className="view-explorer wz-btn wz-btn--sm wz-btn--outline wz-btn--cap-normal"
                  href={`https://chainscan.0g.ai/tx/${txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Explorer
                </a>
              )}
              <button
                type="button"
                className="wz-btn wz-btn--sm wz-btn--primary close-success"
                onClick={() => {
                  setShowSuccess(false);
                  setPendingOrder(null);
                  setPurchaseMethod(null);
                  setTxHash(undefined);
                  onClose?.();
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
      <div className="coin-detail-content">
        <img src={coinImage} alt="Coins" className="coin-detail-image" />
        <div className="wz-btn-stack buy-buttons-stack">
          <button
            type="button"
            className="wz-btn wz-btn--lg wz-btn--primary wz-btn--block buy-button"
            disabled={isSending || isConfirming}
            onClick={handlePurchase}
          >
            {isSending ? 'Processing…' : isConfirming ? 'Confirming…' : 'BUY NOW'}
          </button>
        </div>
        <div className="purchase-meta">
          {(type === 'Guns' || type === 'Coins' || type === 'Gems') && (
            <div className="price-badge">
              {type === 'Guns' && GUN_PRICES_ETH[value] ? `${value} – ${GUN_PRICES_ETH[value]} 0G` : ''}
              {type === 'Coins' && COIN_PRICES_ETH[value] ? `${value} – ${COIN_PRICES_ETH[value]} 0G` : ''}
              {type === 'Gems' && GEM_PRICES_ETH[value] ? `${value} – ${GEM_PRICES_ETH[value]} 0G` : ''}
            </div>
          )}
          {isSending && (
            <div className="status-note pending">
              {purchaseMethod === 'privy'
                ? 'Choose a wallet in Privy and approve the transaction in MetaMask or your selected wallet…'
                : 'Awaiting wallet confirmation…'}
            </div>
          )}
          {isConfirming && (
            <div className="status-note confirming">Confirming on-chain…</div>
          )}
          {(sendError || waitError) && (
            <div className="status-note error">Transaction failed or rejected</div>
          )}
          {txHash && (
            <div className="tx-chip">Tx: {String(txHash).slice(0, 10)}...{String(txHash).slice(-6)}</div>
          )}
        </div>
      </div>
    </div>
  );
};

const IAP = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { address: connectedAddress, isConnected, disconnect } = useWallet();
  const openLogin = () => navigate('/login', { state: { from: location.pathname } });
  const [detailView, setDetailView] = React.useState({
    show: false,
    image: null,
    type: null,
    value: null,
  });
  const [ownedGuns, setOwnedGuns] = useState([]);

  const itemsByCategory = useMemo(() => buildItemsByCategory(ownedGuns), [ownedGuns]);

  useEffect(() => {
    try {
      const addr = localStorage.getItem('walletAddress');
      if (addr) {
        const key = `ownedGuns:${addr.toLowerCase()}`;
        const list = JSON.parse(localStorage.getItem(key) || '[]');
        setOwnedGuns(Array.isArray(list) ? list : []);
      }
    } catch (e) {
      console.warn('Failed to load owned guns:', e);
    }
  }, []);

  useEffect(() => {
    if (!isConnected || !connectedAddress) {
      return;
    }
    let cancelled = false;

    const syncOwnedGuns = async () => {
      try {
        const profile = await getPlayerProfile(connectedAddress);
        const guns = profile?.PlayerGuns || {};
        const ownedSet = new Set();

        Object.entries(guns || {}).forEach(([key, gunValue]) => {
          const gv = gunValue as { id?: string | number } | undefined;
          const id = String(gv?.id ?? key);
          const gunName = GUN_NAME_BY_ID[id];
          if (gunName) ownedSet.add(gunName);
        });

        const ownedList = Array.from(ownedSet);
        if (!cancelled) {
          setOwnedGuns(ownedList);
          try {
            localStorage.setItem(
              `ownedGuns:${connectedAddress.toLowerCase()}`,
              JSON.stringify(ownedList)
            );
          } catch (err) {
            console.warn('Failed to cache owned guns:', err);
          }
        }
      } catch (err) {
        if (!cancelled) {
          console.error('Failed to sync owned guns from backend:', err);
        }
      }
    };

    syncOwnedGuns();
    return () => {
      cancelled = true;
    };
  }, [isConnected, connectedAddress]);

  useEffect(() => {
    if (!isConnected) {
      setOwnedGuns([]);
    }
  }, [isConnected]);

  const closeDetail = () => setDetailView({ show: false, image: null, type: null, value: null });

  const openMarketItem = (item: IapMarketDisplayItem) => {
    if (item.owned) return;
    setDetailView({
      show: true,
      image: item.image,
      type: item.iapType,
      value: item.iapValue,
    });
  };

  return (
    <>
      <IapMarketplaceLayout
        itemsByCategory={itemsByCategory}
        onSelectItem={openMarketItem}
        onRequestLogin={openLogin}
        isConnected={isConnected}
        address={connectedAddress}
        onDisconnect={disconnect}
      />
      <MobileBottomNav current="marketplace" />

      {/* ── Purchase modal ── */}
      <AnimatePresence>
        {detailView.show && (
          <motion.div
            key="purchase-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[160] flex items-center justify-center overflow-y-auto p-4"
            style={{
              background: 'rgba(0,0,0,0.82)',
              backdropFilter: 'blur(6px)',
              paddingTop: 'max(16px, env(safe-area-inset-top, 0px))',
              paddingBottom: 'max(16px, env(safe-area-inset-bottom, 0px))',
            }}
            onClick={closeDetail}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 24 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 24 }}
              transition={{ type: 'spring', stiffness: 240, damping: 22 }}
              className="relative w-full max-w-lg rounded-2xl overflow-x-hidden overflow-y-auto"
              style={{
                maxHeight: 'calc(100dvh - 32px)',
                background: 'linear-gradient(180deg, rgba(30,22,12,0.99) 0%, rgba(12,9,5,1) 100%)',
                border: '1px solid rgba(217,164,65,0.35)',
                boxShadow: '0 24px 60px rgba(0,0,0,0.75), 0 0 0 1px rgba(217,164,65,0.08)',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal header */}
              <div className="sticky top-0 z-10 flex items-center justify-between px-5 py-4 border-b border-gold/20 bg-[rgba(20,15,10,0.96)] backdrop-blur-md">
                <span className="font-orbitron text-sm font-bold text-gold tracking-widest">PURCHASE</span>
                <button
                  type="button"
                  onClick={closeDetail}
                  className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
                >
                  <X className="w-4 h-4 text-muted-foreground" />
                </button>
              </div>

              {/* CoinDetail content */}
              <CoinDetail
                coinImage={detailView.image}
                type={detailView.type}
                value={detailView.value}
                onClose={closeDetail}
                onPurchased={(gunName) => {
                  if (!gunName) return;
                  setOwnedGuns((prev) => {
                    if (prev.includes(String(gunName))) return prev;
                    const next = [...prev, String(gunName)];
                    try {
                      const addr = localStorage.getItem('walletAddress');
                      if (addr) {
                        localStorage.setItem(`ownedGuns:${addr.toLowerCase()}`, JSON.stringify(next));
                      }
                    } catch (e) {
                      console.warn('Failed to persist owned guns:', e);
                    }
                    return next;
                  });
                }}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default IAP;
