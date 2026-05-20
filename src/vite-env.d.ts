/// <reference types="vite/client" />

/** Ambient merge — must be top-level interfaces (not `declare global`) for .d.ts without imports. */
interface Window {
  Buffer?: typeof import('buffer').Buffer;
  web3?: { currentProvider?: unknown };
  toast?: { success?: (...args: unknown[]) => void; error?: (...args: unknown[]) => void };
}

interface Document {
  webkitExitFullscreen?: () => Promise<void> | void;
  mozCancelFullScreen?: () => Promise<void> | void;
  msExitFullscreen?: () => Promise<void> | void;
  webkitFullscreenElement?: Element | null;
  mozFullScreenElement?: Element | null;
  msFullscreenElement?: Element | null;
}

interface ImportMetaEnv {
  readonly VITE_PRIVY_APP_ID?: string
  readonly VITE_WALLET_CONNECT_PROJECT_ID?: string
  readonly VITE_WALLETCONNECT_PROJECT_ID?: string
  readonly VITE_APP_NFT_CONTRACT_ADDRESS?: string
  readonly VITE_APP_NFT_CONTRACT_ADDRESS_2?: string
  readonly VITE_API_BASE_URL?: string
  readonly VITE_API_ORIGIN?: string
  readonly VITE_GAME_URL?: string
  readonly VITE_GAME_MANUAL_URL?: string
  readonly VITE_ALLOWED_CHAIN_ID?: string
  readonly VITE_ALLOWED_CHAIN_NAME?: string
  readonly VITE_ALLOWED_RPC_URL?: string
  readonly VITE_ALLOWED_EXPLORER_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

declare module '*.png' {
  const src: string
  export default src
}

declare module '*.jpg' {
  const src: string
  export default src
}

declare module '*.jpeg' {
  const src: string
  export default src
}

declare module '*.svg' {
  const src: string
  export default src
}

declare module '*.webp' {
  const src: string
  export default src
}

declare module '*.gif' {
  const src: string
  export default src
}
