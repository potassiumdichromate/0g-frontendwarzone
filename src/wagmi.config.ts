import { defineChain } from 'viem';
import { createConfig, http } from 'wagmi';
import { injected } from 'wagmi/connectors';
import { getStableInjectedProvider } from './lib/injectedEthereum';

// Privy + Wagmi: use viem defineChain so custom 0G is recognized like first-class networks (SIWE chainId).
export const zgChain = defineChain({
  id: 16661,
  name: '0G Mainnet',
  nativeCurrency: {
    decimals: 18,
    name: '0G',
    symbol: '0G',
  },
  rpcUrls: {
    default: { http: ['https://evmrpc.0g.ai'] },
  },
  blockExplorers: {
    default: {
      name: '0G Explorer',
      url: 'https://chainscan.0g.ai',
    },
  },
  testnet: false,
});

/** @deprecated Use zgChain; kept for existing imports */
export const somniaChain = zgChain;
/** @deprecated Use zgChain; kept for existing imports */
export const somniaTestnet = zgChain;

const connectors: unknown[] = [
  injected({
    getProvider() {
      return getStableInjectedProvider() ?? undefined;
    },
  } as any),
];

/** Wagmi for IAP / chain hooks — wallet UX is Privy, not RainbowKit */
export const config = createConfig({
  chains: [zgChain],
  connectors: connectors as never,
  transports: {
    [zgChain.id]: http('https://evmrpc.0g.ai'),
  },
});

export default config;
