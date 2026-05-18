import { useCallback, useMemo } from 'react';
import { usePrivy, useWallets, useSendTransaction, useFundWallet } from '@privy-io/react-auth';
import { getAllowedChainFromEnv } from '../lib/chain';

// Fallback chain configuration for 0G mainnet when env vars are not set
const FALLBACK_ALLOWED_CHAIN = {
  caip2: 'eip155:16661',
  decimalChainId: 16661,
  hexChainId: '0x4115',
  chainName: '0G Mainnet',
  rpcUrls: ['https://evmrpc.0g.ai'],
  blockExplorerUrls: ['https://chainscan.0g.ai'],
  nativeCurrency: {
    name: '0G',
    symbol: '0G',
    decimals: 18,
  },
};

const isEmbeddedConnector = (a) => String(a?.connectorType || '').toLowerCase() === 'embedded';

/**
 * Returns a wallet that Privy's `useSendTransaction` can actually use.
 * Priority: connected wallets from useWallets() first (they have a live provider),
 * then fall back to user-linked accounts (display-only, no provider).
 */
export const getPrimaryPrivyWallet = (user, wallets) => {
  const connectedList = Array.isArray(wallets) ? wallets : [];

  // Prefer an external (non-embedded) connected wallet
  const externalConnected = connectedList.find(
    (w) => w?.address && !isEmbeddedConnector(w)
  );
  if (externalConnected) return externalConnected;

  // Any connected wallet (including embedded)
  if (connectedList[0]?.address) return connectedList[0];

  // Fall back to user object wallets (linked but may not be connected)
  if (!user) return undefined;

  if (user.wallet?.address) return user.wallet;

  if (Array.isArray(user.embeddedWallets) && user.embeddedWallets[0]?.address) {
    return user.embeddedWallets[0];
  }

  const linked = Array.isArray(user.linkedAccounts) ? user.linkedAccounts : [];
  const anyWallet = linked.find((a) => a?.type === 'wallet' && a?.address);
  if (anyWallet?.address) return anyWallet;

  return undefined;
};

/**
 * Centralized Privy EVM wallet helpers so they can be
 * copy‑pasted into other projects with minimal changes.
 *
 * Exposes:
 *  - canUsePrivy: boolean (ready, authenticated, has wallet)
 *  - activeWallet: Privy wallet object with address
 *  - allowedChain: chain config (from env or 0G fallback)
 *  - sendPrivyTransaction: raw useSendTransaction sender
 *  - openPrivyFunding: opens Privy's Add funds modal for the active wallet
 */
export const usePrivyWalletTools = () => {
  const { ready, authenticated, user } = usePrivy();
  const { wallets } = useWallets();
  const { sendTransaction } = useSendTransaction();
  const { fundWallet } = useFundWallet();

  const allowedChain = useMemo(
    () => getAllowedChainFromEnv() || FALLBACK_ALLOWED_CHAIN,
    []
  );

  const activeWallet = useMemo(
    () => getPrimaryPrivyWallet(user, wallets),
    [user, wallets]
  );

  const canUsePrivy = Boolean(
    ready &&
    authenticated &&
    activeWallet &&
    activeWallet.address
  );

  const openPrivyFunding = useCallback(
    async (fundingConfig?: Record<string, unknown>) => {
      if (!canUsePrivy) {
        throw new Error('Privy wallet is not ready for funding.');
      }
      if (typeof fundWallet !== 'function') {
        throw new Error('Privy wallet funding is not available in this configuration.');
      }
      const address = activeWallet.address;
      if (!address) {
        throw new Error('No Privy wallet address available for funding.');
      }
      const opts = {
        address,
        ...(allowedChain?.decimalChainId ? { chain: { id: allowedChain.decimalChainId } } : {}),
        ...(fundingConfig && typeof fundingConfig === 'object' ? fundingConfig : {}),
      };
      return (fundWallet as (opts: Record<string, unknown>) => ReturnType<typeof fundWallet>)(opts);
    },
    [canUsePrivy, fundWallet, activeWallet, allowedChain]
  );

  return {
    privyReady: ready,
    privyAuthenticated: authenticated,
    wallets,
    activeWallet,
    canUsePrivy,
    allowedChain,
    sendPrivyTransaction: sendTransaction,
    openPrivyFunding,
  };
};
