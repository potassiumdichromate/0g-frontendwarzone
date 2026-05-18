// Do NOT call stabilizeWindowEthereumForMultiInjectedWallets() here: it pins window.ethereum to one
// extension (MetaMask first), so Privy only sees one injected wallet and skips the multi-wallet UI.
// Wagmi’s injected connector still uses getStableInjectedProvider() in wagmi.config.ts for IAP.

import React, { StrictMode, type ErrorInfo, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WagmiProvider } from 'wagmi';
import { PrivyProvider, type PrivyClientConfig } from '@privy-io/react-auth';
import { config, zgChain } from './wagmi.config';
import { getPrivyAppId } from './lib/privyEnv';
import { PRIVY_WALLET_LIST } from './lib/privyWalletList';
import './index.css';
import App from './App';
import { AppToaster } from './components/AppToaster';

// This ensures the Buffer polyfill is available globally
import { Buffer } from 'buffer';
window.Buffer = Buffer;

const privyAppId = getPrivyAppId();

// Same rule as guess_the_ai_frontend: embedded wallets need a secure context (HTTPS) in the browser
const canUseEmbeddedWallets =
  typeof window === 'undefined' || window.isSecureContext;
// Matches guess_the_ai_frontend/src/lib/privyConfig.ts pattern:
// - No walletConnectCloudProjectId (Privy uses its dashboard default)
// - Named wallets only in walletList (no wallet_connect entry)
// - supportedChains = app chain only
export const privyConfig: PrivyClientConfig = {
  appearance: {
    theme: 'dark' as const,
    accentColor: '#ffc647' as `#${string}`,
    walletChainType: 'ethereum-only',
    showWalletLoginFirst: true,
    walletList: [...PRIVY_WALLET_LIST] as NonNullable<PrivyClientConfig['appearance']>['walletList'],
  },
  ...(canUseEmbeddedWallets
    ? {
        embeddedWallets: {
          ethereum: {
            createOnLogin: 'users-without-wallets',
          },
        },
      }
    : {}),
  loginMethods: ['wallet', 'email', 'google'],
  supportedChains: [zgChain],
  defaultChain: zgChain,
  intl: {
    defaultCountry: 'US',
  },
};


if (!privyAppId) {
  console.warn('VITE_PRIVY_APP_ID is not set. Privy login will be disabled.');
}

// Create a client for React Query
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

type ErrorBoundaryProps = { children: ReactNode };
type ErrorBoundaryState = { hasError: boolean; error: Error | null };

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ 
          padding: '20px', 
          color: 'white', 
          backgroundColor: '#ff3333',
          fontFamily: 'Arial, sans-serif',
          textAlign: 'center',
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 1000
        }}>
          <h2>Something went wrong</h2>
          <p>{this.state.error?.toString()}</p>
          <button 
            onClick={() => window.location.reload()}
            style={{
              marginTop: '10px',
              padding: '8px 16px',
              backgroundColor: 'white',
              color: '#ff3333',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Reload Page
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

const rootElement = document.getElementById('root');

// Check if the root element exists
if (!rootElement) {
  console.error('Root element not found');
} else {
  const root = createRoot(rootElement);
  
  try {
    root.render(
      <StrictMode>
        <ErrorBoundary>
          <PrivyProvider appId={privyAppId} config={privyConfig}>
            <WagmiProvider config={config}>
              <QueryClientProvider client={queryClient}>
                <App />
                <AppToaster />
              </QueryClientProvider>
            </WagmiProvider>
          </PrivyProvider>
        </ErrorBoundary>
      </StrictMode>
    );
  } catch (error: unknown) {
    console.error('Error rendering app:', error);
    const message = error instanceof Error ? error.message : String(error);
    root.render(
      <div style={{ 
        padding: '20px', 
        color: 'white', 
        backgroundColor: '#ff3333',
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        fontFamily: 'Arial, sans-serif'
      }}>
        <h1>Critical Error</h1>
        <p>Failed to load the application. Please try refreshing the page.</p>
        <p>Error: {message}</p>
        <button 
          onClick={() => window.location.reload()}
          style={{
            marginTop: '20px',
            padding: '10px 20px',
            backgroundColor: 'white',
            color: '#ff3333',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '16px'
          }}
        >
          Reload Page
        </button>
      </div>
    );
  }
}
