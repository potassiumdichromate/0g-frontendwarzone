import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  type ReactNode,
} from 'react';
import { useAccount, useDisconnect, useConnect, useSwitchChain, useChainId, useConnectors } from 'wagmi';
import { usePrivy, useWallets } from '@privy-io/react-auth';
import { getPlayerProfile, getPlayerName, loginUser } from '../utils/api';
import { createPublicClient, http } from 'viem';
import { getStableInjectedProvider } from '../lib/injectedEthereum';

const DEBUG_LOGIN_TRACE = String(import.meta.env.VITE_DEBUG_LOGIN_TRACE || '').toLowerCase() === 'true';
const trace = (...args: unknown[]) => {
  if (DEBUG_LOGIN_TRACE) {
    console.log('[wallet-trace]', ...args);
  }
};

// 0G Network Configuration (Mainnet)
export const zgChain = {
  id: 16661,
  name: '0G Mainnet',
  network: '0g',
  nativeCurrency: {
    name: '0G',
    symbol: '0G',
    decimals: 18,
  },
  rpcUrls: {
    default: { http: ['https://evmrpc.0g.ai'] },
    public: { http: ['https://evmrpc.0g.ai'] },
  },
  blockExplorers: {
    default: {
      name: '0G Explorer',
      url: 'https://chainscan.0g.ai',
    },
  },
  testnet: false,
};


// NFT Contract Addresses from environment variables
console.log('Environment variables:', import.meta.env);
const NFT_CONTRACT_ADDRESS = import.meta.env.VITE_APP_NFT_CONTRACT_ADDRESS ?? "0xe5cB757613bE827b836029d5E2700D76466745BD";
const NFT_CONTRACT_ADDRESS_2 = import.meta.env.VITE_APP_NFT_CONTRACT_ADDRESS_2 ?? "0xf4aacc6576b9749c3c7aab51f3050027f5a720be";
console.log('NFT Contract Address 1:', NFT_CONTRACT_ADDRESS);
console.log('NFT Contract Address 2:', NFT_CONTRACT_ADDRESS_2);

export type WalletContextValue = {
  isConnected: boolean;
  address: string | null;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  setUserToken: (address: string) => Promise<unknown>;
  isNFTOwner: boolean;
  checkNFTOwnership: (walletAddress?: string | null) => Promise<boolean>;
  switchTo0G: () => Promise<boolean>;
  playerProfile: any | null;
  profileLoading: boolean;
  refreshProfile: (walletAddress?: string | null) => Promise<any | null>;
};

const defaultWalletContext: WalletContextValue = {
  isConnected: false,
  address: null,
  connect: async () => {},
  disconnect: async () => {},
  setUserToken: async () => null,
  isNFTOwner: false,
  checkNFTOwnership: async () => false,
  switchTo0G: async () => false,
  playerProfile: null,
  profileLoading: false,
  refreshProfile: async () => null,
};

const WalletContext = createContext<WalletContextValue>(defaultWalletContext);

function readStoredSession() {
  if (typeof window === 'undefined') {
    return { walletAddress: null, token: null };
  }

  const walletAddress = localStorage.getItem('walletAddress');
  const token = localStorage.getItem('token');
  return { walletAddress, token };
}

export const WalletProvider = ({ children }: { children: ReactNode }) => {
  const [isNFTOwner, setIsNFTOwner] = useState(false);
  const backendLoginSentRef = useRef(null);
  const backendLoginSentFromConnectedRef = useRef(null);
  const logoutInProgressRef = useRef(false);
  const privyLoginAttemptedForRef = useRef<string | null>(null);
  const fallbackLoginAttemptedForRef = useRef<string | null>(null);
  const [privyAddress, setPrivyAddress] = useState(null);
  const [storedSession, setStoredSession] = useState(readStoredSession);
  const [playerProfile, setPlayerProfile] = useState<any | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  
  // Wagmi hooks (optional path alongside Privy)
  const { address: wagmiAddress, isConnected: wagmiIsConnected } = useAccount();
  const { disconnectAsync } = useDisconnect();
  const { connectAsync } = useConnect();
  const connectors = useConnectors();
  const { switchChain } = useSwitchChain();
  const chainId = useChainId();
  const { ready: privyReady, authenticated: privyAuthenticated, user: privyUser, logout: privyLogout } = usePrivy();
  const { wallets: privyWallets } = useWallets();

  const syncStoredSession = useCallback(() => {
    setStoredSession(readStoredSession());
  }, []);

  const refreshProfile = useCallback(async (walletAddress?: string | null) => {
    const addressToLoad =
      walletAddress ||
      wagmiAddress ||
      privyAddress ||
      readStoredSession().walletAddress;

    const token = localStorage.getItem('token');
    if (!addressToLoad || !token) {
      setPlayerProfile(null);
      setProfileLoading(false);
      return null;
    }

    setProfileLoading(true);
    try {
      const profile = await getPlayerProfile(addressToLoad);
      setPlayerProfile(profile);
      return profile;
    } catch (error) {
      console.error('Failed to refresh player profile:', error);
      return null;
    } finally {
      setProfileLoading(false);
    }
  }, [privyAddress, wagmiAddress]);
  
  // Handle disconnection — Privy logout first (while session is still valid),
  // then nuke all local state and force reload.
  const handleDisconnect = useCallback(async () => {
    logoutInProgressRef.current = true;

    // 1. Privy logout (bounded wait — on mobile the API can hang; we still must clear locally)
    const PRIVY_LOGOUT_MAX_MS = 6000;
    if (privyLogout) {
      try {
        await Promise.race([
          privyLogout(),
          new Promise<void>((resolve) => {
            window.setTimeout(resolve, PRIVY_LOGOUT_MAX_MS);
          }),
        ]);
      } catch {
        /* 400 / network — continue with local teardown */
      }
    }

    // 2. Wagmi disconnect (await so connector state clears before reload)
    try {
      await disconnectAsync();
    } catch {
      /* no active connector */
    }

    // 3. Clear ALL React state
    backendLoginSentRef.current = null;
    backendLoginSentFromConnectedRef.current = null;
    setIsNFTOwner(false);
    setPrivyAddress(null);
    setPlayerProfile(null);
    setProfileLoading(false);
    setStoredSession({ walletAddress: null, token: null });

    // 4. Nuke all app localStorage keys
    const keysToRemove = [
      'walletConnected', 'walletAddress', 'token',
      'Intraverse', 'intraverseUserId', 'intraverseUserInfo',
      'intraversePendingAuthHash', 'intraverseClientKey', 'intraverseMagicLoginUrl',
      'loginType', 'loginTimestamp',
    ];
    keysToRemove.forEach((k) => localStorage.removeItem(k));

    // Also clear any ownedGuns cache entries
    const allKeys = Object.keys(localStorage);
    allKeys.forEach((k) => {
      if (k.startsWith('ownedGuns:') || k.startsWith('privy:')) {
        localStorage.removeItem(k);
      }
    });

    // 5. Clear sessionStorage (Privy may store tokens here)
    try { sessionStorage.clear(); } catch {}

    // 6. Hard navigation (replace avoids back-forward cache restoring logged-in state on mobile)
    const origin = window.location.origin;
    window.location.replace(`${origin}/?logout=${Date.now()}`);
  }, [disconnectAsync, privyLogout]);

  useEffect(() => {
    window.addEventListener('storage', syncStoredSession);
    window.addEventListener('intraverse-user-saved', syncStoredSession);
    window.addEventListener('warzone-session-changed', syncStoredSession);
    return () => {
      window.removeEventListener('storage', syncStoredSession);
      window.removeEventListener('intraverse-user-saved', syncStoredSession);
      window.removeEventListener('warzone-session-changed', syncStoredSession);
    };
  }, [syncStoredSession]);
  
  // Check if wallet is connected on mount and on address change.
  // Deps are intentionally [wagmiIsConnected, wagmiAddress] only — chainId/switchChain
  // would cause re-runs when the chain switches, looping the backend /login call.
  useEffect(() => {
    const checkConnection = async () => {
      if (logoutInProgressRef.current) return;
      if (wagmiIsConnected && wagmiAddress) {
        localStorage.setItem('walletConnected', 'true');
        localStorage.setItem('walletAddress', wagmiAddress);

        try {
          await setUserToken(wagmiAddress);
          setIsNFTOwner(true);
        } catch (error) {
          console.error('Error during wallet connection setup:', error);
        }
      }
    };

    checkConnection();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wagmiIsConnected, wagmiAddress]);

  // Prefer external (injected) wallet from linkedAccounts — matches Privy + GUESS_THE_AI flow
  // so MetaMask / Bitget / OKX logins resolve the correct address for /login.
  const getPrimaryPrivyAddress = useCallback((user, wallets) => {
    if (!user) return undefined;
    const linked = Array.isArray(user.linkedAccounts) ? user.linkedAccounts : [];
    const isEmbedded = (a) => String(a?.connectorType || '').toLowerCase() === 'embedded';

    const externalLinked = linked.find(
      (a) => a?.type === 'wallet' && a?.address && !isEmbedded(a)
    );
    if (externalLinked?.address) return externalLinked.address;

    if (user.wallet?.address && !isEmbedded(user.wallet)) {
      return user.wallet.address;
    }

    if (user.wallet?.address) return user.wallet.address;

    if (Array.isArray(user.embeddedWallets) && user.embeddedWallets[0]?.address) {
      return user.embeddedWallets[0].address;
    }
    if (Array.isArray(user.wallets) && user.wallets[0]?.address) {
      return user.wallets[0].address;
    }
    if (Array.isArray(wallets) && wallets[0]?.address) {
      return wallets[0].address;
    }
    const anyWallet = linked.find((a) => a?.type === 'wallet' && a?.address);
    if (anyWallet?.address) return anyWallet.address;
    return undefined;
  }, []);

  // Only reset login-attempt guards when Privy auth state goes from true→false (actual logout).
  // Skip if user was never Privy-authenticated (e.g. Intraverse-only login).
  const wasPreviouslyPrivyAuthRef = useRef(false);
  useEffect(() => {
    if (privyAuthenticated) {
      wasPreviouslyPrivyAuthRef.current = true;
    } else if (wasPreviouslyPrivyAuthRef.current) {
      wasPreviouslyPrivyAuthRef.current = false;
      backendLoginSentRef.current = null;
      backendLoginSentFromConnectedRef.current = null;
      privyLoginAttemptedForRef.current = null;
      fallbackLoginAttemptedForRef.current = null;
    }
  }, [privyAuthenticated]);

  
  
  // Check NFT ownership using direct blockchain verification
  const checkNFTOwnership = useCallback(async (walletAddress) => {
    console.log('Starting NFT ownership check for:', walletAddress);
    if (!walletAddress) {
      console.log('No wallet address provided');
      return false;
    }

    try {
      // First try to use the injected provider from Wagmi / browser
      const w = window as Window & { web3?: { currentProvider?: unknown } };
      const provider = window.ethereum || (w.web3 && w.web3.currentProvider);
      
      // If no provider is found, check for WalletConnect or other injected providers
      if (!provider) {
        // Try to detect if we're in a mobile web environment
        if (window.ethereum?.isMetaMask || 
            window.ethereum?.isTrust || 
            window.ethereum?.isStatus ||
            window.ethereum?.isImToken) {
          // We have an injected provider
          console.log('Using injected provider for NFT check');
        } else if (w.web3) {
          // Legacy web3 provider
          console.log('Using legacy web3 provider for NFT check');
        } else {
          // No provider detected, might be mobile web
          console.log('No Web3 provider detected, might be mobile web');
          // For mobile web, we should use WalletConnect or similar
          // For now, we'll just return false and log the issue
          console.warn('Web3 provider not found. Please use a Web3-compatible browser or wallet.');
          setIsNFTOwner(true);
          return false;
        }
      }

      console.log('Checking NFT ownership via blockchain...');
      const hasNFT = await checkNFTOwnershipDirect(walletAddress);
      console.log("has NFT ",hasNFT)
      setIsNFTOwner(hasNFT);
      return hasNFT;
      
    } catch (error) {
      console.error('Blockchain check failed:', error);
      // In case of error, we'll assume no NFT to avoid blocking the user
      // You might want to implement a fallback API check here
      // setIsNFTOwner(false);
      return true;
    }
  }, [wagmiAddress]);

  // Blockchain check using viem
  // const checkNFTOwnershipDirect = async (walletAddress) => {
    
  //   try {
    
  //     if (!window.ethereum) {
  //       throw new Error('No Ethereum provider available');
  //     }

  //     // ERC-721 ABI with balanceOf and supportsInterface
  //     const erc721ABI = [
  //       {
  //         "inputs": [{"internalType": "address", "name": "owner", "type": "address"}],
  //         "name": "balanceOf",
  //         "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
  //         "stateMutability": "view",
  //         "type": "function"
  //       },
  //       {
  //         "inputs": [{"internalType": "bytes4", "name": "interfaceId", "type": "bytes4"}],
  //         "name": "supportsInterface",
  //         "outputs": [{"internalType": "bool", "name": "", "type": "bool"}],
  //         "stateMutability": "view",
  //         "type": "function"
  //       }
  //     ];

  //     console.log('Calling balanceOf for address:', walletAddress);
      
  //     // Create a public client for read operations
  //     const publicClient = createPublicClient({
  //       chain: zgChain,
  //       transport: http('https://dream-rpc.somnia.network')
  //     });

  //     // Check if contract supports ERC721 interface
  //     console.log('Checking if contract supports ERC721 interface...');
  //     const isERC721 = await publicClient.readContract({
  //       address: NFT_CONTRACT_ADDRESS,
  //       abi: erc721ABI,
  //       functionName: 'supportsInterface',
  //       args: ['0x80ac58cd'] // ERC721 interface ID
  //     });

  //     if (!isERC721) {
  //       console.error('Contract does not support ERC721 interface');
  //       return false;
  //     }
      
  //     console.log('Sending balanceOf request...');
  //     const balance = await publicClient.readContract({
  //       address: NFT_CONTRACT_ADDRESS,
  //       abi: erc721ABI,
  //       functionName: 'balanceOf',
  //       args: [walletAddress]
  //     });
      
  //     const hasNFT = BigInt(balance) > 0n;
  //     console.log('NFT check result:', { 
  //       balance: balance.toString(),
  //       hasNFT,
  //       contractAddress: NFT_CONTRACT_ADDRESS,
  //       chainId: zgChain.id
  //     });
      
  //     return hasNFT;
      
  //   } catch (error) {
  //     console.error('Error in direct NFT check:', {
  //       message: error.message,
  //       code: error.code,
  //       data: error.data,
  //       stack: error.stack,
  //       contractAddress: NFT_CONTRACT_ADDRESS,
  //       walletAddress: walletAddress
  //     });
  //     throw error; // Re-throw to be handled by the caller
  //   }
  // };

  // Blockchain check using viem via Ankr RPC (checks both NFT contracts)
  const checkNFTOwnershipDirect = async (walletAddress) => {
    try {
      console.log("1.walletADdress: ",walletAddress)
      if (!walletAddress) throw new Error('No wallet address provided');

      const erc721ABI = [
        {
          inputs: [{ internalType: "address", name: "owner", type: "address" }],
          name: "balanceOf",
          outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
          stateMutability: "view",
          type: "function",
        },
      ];

      const publicClient = createPublicClient({
        chain: zgChain,
        transport: http('https://api.infra.mainnet.somnia.network'),
      });

      // Function to check a single contract
      const checkContract = async (contractAddress) => {
        try {
          const balance = await publicClient.readContract({
            address: contractAddress as `0x${string}`,
            abi: erc721ABI,
            functionName: 'balanceOf',
            args: [walletAddress as `0x${string}`],
          } as never);
          return BigInt(String(balance)) > 0n;
        } catch (error) {
          console.error(`Error checking NFT contract ${contractAddress}:`, error);
          return false;
        }
      };

      // Check both contracts in parallel
      const [hasNFT1, hasNFT2] = await Promise.all([
        checkContract(NFT_CONTRACT_ADDRESS),
        checkContract(NFT_CONTRACT_ADDRESS_2)
      ]);

      const hasNFT = hasNFT1 || hasNFT2;
      console.log('NFT check result:', {
        hasNFT1,
        hasNFT2,
        hasAnyNFT: hasNFT,
        contract1: NFT_CONTRACT_ADDRESS,
        contract2: NFT_CONTRACT_ADDRESS_2,
        chainId: zgChain.id,
      });

      return hasNFT;
    } catch (error) {
      console.error('Error in NFT ownership check:', {
        message: error?.message,
        code: error?.code,
        data: error?.data,
        stack: error?.stack,
        walletAddress,
      });
      return true;
    }
  };



  // Switch to 0G network
  const switchTo0G = useCallback(async () => {
    // Never throw; return boolean so UI can gracefully proceed
    try {
      if (chainId === zgChain.id) return true;

      try {
        await switchChain({ chainId: zgChain.id });
        return true;
      } catch (switchError) {
        console.error('Error switching to 0G:', switchError);

        if (switchError?.code === 4902) {
          try {
            const injected = typeof window !== 'undefined' ? getStableInjectedProvider() : null;
            if (injected?.request) {
              await injected.request({
                method: 'wallet_addEthereumChain',
                params: [{
                  chainId: `0x${zgChain.id.toString(16)}`,
                  chainName: zgChain.name,
                  nativeCurrency: zgChain.nativeCurrency,
                  rpcUrls: [zgChain.rpcUrls.public.http[0]],
                  blockExplorerUrls: zgChain.blockExplorers ? [zgChain.blockExplorers.default.url] : []
                }]
              });
              return true;
            }
            console.warn('No ethereum provider available to add chain.');
            return false;
          } catch (addError) {
            console.error('Failed to add 0G network:', addError);
            return false;
          }
        }

        if (switchError?.code === 4001) {
          console.warn('User rejected network switch. Proceeding.');
          return false;
        }
        return false;
      }
    } catch (error) {
      console.error('Error in switchTo0G (non-fatal):', error);
      return false;
    }
  }, [chainId, switchChain]);

  const checkPlayerName = useCallback(async (walletAddress: string) => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return null;
      return await getPlayerName(walletAddress);
    } catch (error) {
      console.error('Error checking player name:', error);
      return null;
    }
  }, []);

  const setUserTokenLockRef = useRef<string | null>(null);

  const setUserToken = useCallback(async (_address) => {
    try {
      if (!_address) {
        throw new Error('Could not get wallet address');
      }

      const normalizedAddr = _address.toLowerCase();

      // Prevent duplicate/concurrent calls for the same address
      if (setUserTokenLockRef.current === normalizedAddr) {
        console.log('[WalletContext] setUserToken: skipped (already in progress for', _address, ')');
        return null;
      }

      // Skip if already logged in for this address
      const existingToken = localStorage.getItem('token');
      const existingAddr = localStorage.getItem('walletAddress');
      if (existingToken && existingAddr?.toLowerCase() === normalizedAddr) {
        console.log('[WalletContext] setUserToken: skipped (already logged in for', _address, ')');
        return null;
      }

      setUserTokenLockRef.current = normalizedAddr;
      console.log('[WalletContext] setUserToken: auth nonce+signature for', _address);

      let provider: { request: (args: { method: string; params?: unknown[] }) => Promise<unknown> } | null =
        getStableInjectedProvider() as typeof provider;
      const privyWallet = Array.isArray(privyWallets) ? privyWallets[0] : null;
      if (privyWallet && typeof privyWallet.getEthereumProvider === 'function') {
        try {
          provider = (await privyWallet.getEthereumProvider()) as typeof provider;
        } catch {
          /* fall back to injected */
        }
      }
      if (!provider && typeof window !== 'undefined') {
        provider = (window as Window & { ethereum?: typeof provider }).ethereum ?? null;
      }

      const loginResult = await loginUser(_address, provider);
      if (loginResult.token) {
        localStorage.setItem('token', loginResult.token);
        localStorage.setItem('walletAddress', _address);
        setStoredSession({ walletAddress: _address, token: loginResult.token });
        await refreshProfile(_address);
        const playerInfo = await checkPlayerName(_address);
        return playerInfo;
      }
      return null;
    } catch (error) {
      console.error("Wallet connection error:", error);
      return null;
    } finally {
      setUserTokenLockRef.current = null;
    }
  }, [checkPlayerName, refreshProfile, privyWallets]);

  // When a Privy session is authenticated, mirror it into our wallet state.
  // Deps are kept minimal — privyUser/privyWallets change references every render,
  // so we rely on the address-based ref guard to prevent duplicate calls.
  useEffect(() => {
    if (logoutInProgressRef.current) return;
    if (!privyReady || !privyAuthenticated) return;

    const addr = getPrimaryPrivyAddress(privyUser, privyWallets);
    if (!addr) return;

    // Already handled this address — only update privyAddress (idempotent)
    if (privyLoginAttemptedForRef.current?.toLowerCase() === addr.toLowerCase()) {
      setPrivyAddress((prev) => prev === addr ? prev : addr);
      return;
    }

    const stored = localStorage.getItem('walletAddress');
    const token = localStorage.getItem('token');
    if (token && stored && stored.toLowerCase() === addr.toLowerCase()) {
      privyLoginAttemptedForRef.current = addr;
      backendLoginSentRef.current = addr;
      setPrivyAddress(addr);
      localStorage.setItem('walletConnected', 'true');
      trace('privySession:alreadyLoggedIn', { addr });
      return;
    }

    privyLoginAttemptedForRef.current = addr;
    backendLoginSentRef.current = addr;
    setPrivyAddress(addr);

    (async () => {
      try {
        await setUserToken(addr);
        if (!localStorage.getItem('token')) {
          trace('privySession:backendLoginFailed', { addr });
          return;
        }
        localStorage.setItem('walletConnected', 'true');
        localStorage.setItem('walletAddress', addr);
        trace('privySession:backendLoginSuccess', { addr });
      } catch (err) {
        console.warn('Failed to persist Privy wallet info:', err);
        trace('privySession:persistFailed', err);
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [privyReady, privyAuthenticated]);

  // Mobile fallback: if wallet is connected but Privy auth is delayed, still try backend login by address.
  // Skip entirely if user already has a valid session (e.g. Intraverse login).
  useEffect(() => {
    if (logoutInProgressRef.current) return;
    if (!privyReady || privyAuthenticated) return;

    // If there's already a stored session (Intraverse or prior login), don't override it
    const existingToken = localStorage.getItem('token');
    const existingAddr = localStorage.getItem('walletAddress');
    if (existingToken && existingAddr) return;

    const connectedAddr = Array.isArray(privyWallets) ? privyWallets[0]?.address : undefined;
    if (!connectedAddr) return;

    setPrivyAddress(connectedAddr);

    if (fallbackLoginAttemptedForRef.current?.toLowerCase() === connectedAddr.toLowerCase()) return;

    fallbackLoginAttemptedForRef.current = connectedAddr;
    (async () => {
      try {
        await setUserToken(connectedAddr);
        const nextToken = localStorage.getItem('token');
        if (!nextToken) return;
        localStorage.setItem('walletConnected', 'true');
        localStorage.setItem('walletAddress', connectedAddr);
      } catch {}
    })();
  }, [privyReady, privyAuthenticated, privyWallets, setUserToken]);

  const connectWallet = useCallback(async () => {
    try {
      const connector = connectors[0];
      if (!connector) {
        console.error('No wagmi connector available');
        return;
      }
      const result = await connectAsync({ connector });
      const accountAddress = result.accounts[0];
      if (accountAddress) {
        localStorage.setItem('walletConnected', 'true');
        localStorage.setItem('walletAddress', accountAddress);
        console.log('calling 1 ', accountAddress);
        try {
          const hasNFT = await checkNFTOwnership(accountAddress);
          setIsNFTOwner(hasNFT);
        } catch (error) {
          console.error('Error checking NFT ownership:', error);
        }
      }
    } catch (error) {
      console.error('Error connecting wallet:', error);
    }
  }, [connectAsync, connectors, checkNFTOwnership]);

  // Enforce 0G network whenever connected or chain changes
  useEffect(() => {
    const ensure0G = async () => {
      try {
        if (wagmiIsConnected && chainId !== zgChain.id) {
          await switchTo0G();
        }
      } catch (e) {
        console.warn('Enforcing 0G network failed:', e);
      }
    };
    ensure0G();
  }, [wagmiIsConnected, chainId, switchTo0G]);

  const sessionAddress = storedSession.walletAddress || null;
  const sessionConnected = Boolean(storedSession.walletAddress && storedSession.token);
  const effectiveAddress = wagmiAddress || privyAddress || sessionAddress;
  const hasConnectedPrivyWallet = Boolean(Array.isArray(privyWallets) && privyWallets[0]?.address);
  const isPrivyConnected = Boolean((privyReady && privyAuthenticated && privyAddress) || (privyReady && hasConnectedPrivyWallet));
  const effectiveIsConnected = Boolean(wagmiIsConnected || isPrivyConnected || sessionConnected);

  useEffect(() => {
    if (!effectiveIsConnected || !effectiveAddress || !storedSession.token) {
      setPlayerProfile(null);
      setProfileLoading(false);
      return;
    }

    void refreshProfile(effectiveAddress);
  }, [effectiveAddress, effectiveIsConnected, refreshProfile, storedSession.token]);

  return (
    <WalletContext.Provider
      value={{
        isConnected: effectiveIsConnected,
        address: effectiveAddress,
        connect: connectWallet,
        disconnect: handleDisconnect,
        isNFTOwner,
        checkNFTOwnership,
        switchTo0G,
        setUserToken,
        playerProfile,
        profileLoading,
        refreshProfile,
      }}
    >
      {children}
    </WalletContext.Provider>
  );

};

export const useWallet = () => {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error('useWallet must be used within a WalletProvider');
  }
  return context;
};
