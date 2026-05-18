import { useCallback, useEffect, useState, useRef } from 'react'
import type React from 'react'
import {
  useLoginWithEmail,
  useLoginWithOAuth,
  useLogin,
  usePrivy,
  useCreateWallet,
  useWallets,
} from '@privy-io/react-auth'

import intraverseLogo from '../assets/Intraverse_logo-cropped.png'
import { buildApiUrl } from '../config/api'
import './LoginModal.css'

const DEBUG_LOGIN_TRACE = String((import.meta as any).env?.VITE_DEBUG_LOGIN_TRACE || '').toLowerCase() === 'true'
const trace = (...args: unknown[]) => {
  if (DEBUG_LOGIN_TRACE) console.log('[login-modal-trace]', ...args)
}

/* ============================== Helpers ============================== */
function getPrimaryWalletAddress(user: any | undefined | null): string | undefined {
  if (!user) return undefined
  const linked = Array.isArray(user.linkedAccounts) ? user.linkedAccounts : []
  const isEmbedded = (a: any) => String(a?.connectorType || '').toLowerCase() === 'embedded'
  const externalLinked = linked.find(
    (a: any) => a?.type === 'wallet' && a?.address && !isEmbedded(a)
  )
  if (externalLinked?.address) return externalLinked.address
  if (user.wallet?.address && !isEmbedded(user.wallet)) return user.wallet.address
  if (user.wallet?.address) return user.wallet.address
  if (Array.isArray(user.embeddedWallets) && user.embeddedWallets[0]?.address) {
    return user.embeddedWallets[0].address
  }
  if (Array.isArray(user.wallets) && user.wallets[0]?.address) {
    return user.wallets[0].address
  }
  const anyWallet = linked.find((a: any) => a?.type === 'wallet' && a?.address)
  if (anyWallet?.address) return anyWallet.address
  return undefined
}

function deriveAuthMethodFromUser(user: any | undefined | null): 'email' | 'oauth' | null {
  if (!user) return null
  // Prefer Google if present
  if (
    user.google?.email ||
    (Array.isArray(user.linkedAccounts) &&
      user.linkedAccounts.some((a: any) => a?.type === 'google' || a?.type === 'google_oauth'))
  ) {
    return 'oauth'
  }
  // Else fall back to email if present
  if (user.email?.address) return 'email'
  return null
}

function isEmailOrSocialPrivyUser(user: any | undefined | null): boolean {
  return deriveAuthMethodFromUser(user) === 'email' || deriveAuthMethodFromUser(user) === 'oauth'
}

/* ============================== Icons ============================== */
const WalletIcon = ({ size = 18 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <path d="M3.75 7.5h13.5a3 3 0 0 1 3 3v6.75a3 3 0 0 1-3 3H6.75a3 3 0 0 1-3-3V9.75a2.25 2.25 0 0 1 2.25-2.25Z" stroke="currentColor" strokeWidth="1.6"/>
    <path d="M18.75 12.75h-2.25a1.5 1.5 0 1 0 0 3h2.25a.75.75 0 0 0 .75-.75v-1.5a.75.75 0 0 0-.75-.75Z" fill="currentColor"/>
    <path d="M17.25 5.25H6a2.25 2.25 0 0 0-2.25 2.25v1.5" stroke="currentColor" strokeWidth="1.6"/>
  </svg>
)

const GoogleIcon = ({ size = 18 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24">
    <path fill="#4285F4" d="M23.6 12.3c0-.8-.1-1.6-.2-2.3H12v4.4h6.5c-.3 1.6-1.3 3-2.7 3.9v3.2h4.4c2.6-2.3 4.1-5.6 4.1-9.2z"/>
    <path fill="#34A853" d="M12 24c3.6 0 6.6-1.2 8.8-3.2l-4.4-3.2c-1.2.8-2.7 1.3-4.4 1.3-3.4 0-6.2-2.3-7.2-5.3H.2v3.3C2.3 21.3 6.8 24 12 24z"/>
    <path fill="#FBBC05" d="M4.8 13.6c-.3-1-.3-2 0-3V7.3H.2C-1 9.6-1 12.4.2 14.7l4.6-1.1z"/>
    <path fill="#EA4335" d="M12 4.7c1.9 0 3.6.7 4.9 1.9l3.7-3.7C18.6 1 15.6 0 12 0 6.8 0 2.3 2.7.2 7.3l4.6 3.3C5.8 7.1 8.6 4.7 12 4.7z"/>
  </svg>
)

/* ============================== Types ============================== */
type LoginModalProps = {
  open: boolean
  onClose: () => void
  logoSrc?: string
  leftLogoSrc?: string
  centerLogoSrc?: string
  rightLogoSrc?: string
}

/* ============================== Small Components ============================== */
function HeaderLogos({
  leftLogoSrc,
  rightLogoSrc,
}: { leftLogoSrc?: string; rightLogoSrc?: string }) {
  if (!leftLogoSrc && !rightLogoSrc) return null

  return (
    <div className="wz-login-brand-row" aria-hidden="true">
      {leftLogoSrc && (
        <span className="wz-login-brand-chip">
          <img
            src={leftLogoSrc}
            alt="Left logo"
            className="wz-login-brand-logo wz-login-brand-logo--wide"
          />
        </span>
      )}
      {rightLogoSrc && (
        <span className="wz-login-brand-chip">
          <img
            src={rightLogoSrc}
            alt="Right logo"
            className="wz-login-brand-logo"
          />
        </span>
      )}
    </div>
  )
}

function TitleCard() {
  return (
    <div className="wz-login-title-card">
      <h2 className="wz-login-title" id="wz-login-title">
        Sign in
      </h2>
      <p className="wz-login-subtitle">
        Email, Google, wallet, or Intraverse.
      </p>
    </div>
  )
}

function ErrorBanner({ error }: { error?: string }) {
  if (!error) return null
  return (
    <div className="wz-login-alert wz-login-alert--error">
      {error}
    </div>
  )
}

function getFriendlyPrivyErrorMessage(errorCode: string | undefined, fallback?: string) {
  switch (errorCode) {
    case 'exited_auth_flow':
      return ''
    case 'client_request_timeout':
      return 'Wallet login took too long. Please keep the wallet app open and try again.'
    case 'allowlist_rejected':
      return 'This site origin is not allowed for wallet login in the current Privy configuration.'
    case 'unsupported_chain_id':
      return 'Your wallet could not switch to the 0G network (chain 16661). In MetaMask, approve adding 0G when prompted, then try again.'
    case 'unable_to_sign':
    case 'invalid_message':
      return 'Signature was not completed. Unlock MetaMask, approve the network if asked, then sign the login message.'
    case 'generic_connect_wallet_error':
    case 'unknown_connect_wallet_error':
      return "Wallet connection failed. On mobile: use MetaMask app via WalletConnect, approve 0G (16661) when prompted, and complete the signature. If it keeps failing, try opening the site inside MetaMask’s browser."
    default:
      return fallback || ''
  }
}

function getOriginInfo() {
  if (typeof window === 'undefined') {
    return { origin: 'unknown', protocol: 'unknown', hostname: 'unknown' }
  }
  return {
    origin: window.location.origin,
    protocol: window.location.protocol,
    hostname: window.location.hostname,
  }
}

function isMobilePrivyOriginSupported() {
  const { protocol, hostname } = getOriginInfo()
  const isHttps = protocol === 'https:'
  const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1'
  return isHttps || isLocalhost
}

function EmbeddedWalletBadge({ address }: { address?: string }) {
  if (!address) return null
  return (
    <div className="wz-login-badge">
      Wallet: <span className="font-mono text-[11px] text-white/95">{address}</span>
    </div>
  )
}

function DividerOr() {
  return (
    <div className="wz-login-divider">
      <span className="wz-login-divider-line" />
      <span className="wz-login-divider-label">or</span>
      <span className="wz-login-divider-line" />
    </div>
  )
}

function EmailForm({
  email,
  setEmail,
  emailState,
  onEmailSubmit,
  setLoginMethod,
  disabled,
}: {
  email: string
  setEmail: (s: string) => void
  emailState: ReturnType<typeof useLoginWithEmail>['state']
  onEmailSubmit: React.FormEventHandler<HTMLFormElement>
  setLoginMethod: (m: 'email' | 'oauth' | null) => void
  disabled: boolean
}) {
  return (
    <form className="grid gap-3" onSubmit={onEmailSubmit}>
      <label className="grid gap-2">
        <span className="wz-login-field-label">Email address</span>
        <input
          type="email"
          required
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="wz-login-input"
          disabled={disabled}
        />
      </label>
      <div className="mt-1">
        <button
          type="submit"
          className="wz-login-primary"
          disabled={
            disabled ||
            emailState.status === 'sending-code' ||
            emailState.status === 'submitting-code'
          }
          onClick={() => setLoginMethod('email')}
        >
          {emailState.status === 'sending-code' ? 'Sending…' : 'Send code'}
        </button>
      </div>
    </form>
  )
}

function CodeForm({
  code,
  setCode,
  onBack,
  onCodeSubmit,
  emailState,
}: {
  code: string
  setCode: (s: string) => void
  onBack: () => void
  onCodeSubmit: React.FormEventHandler<HTMLFormElement>
  emailState: ReturnType<typeof useLoginWithEmail>['state']
}) {
  return (
    <form className="grid gap-3" onSubmit={onCodeSubmit}>
      <label className="grid gap-2">
        <span className="wz-login-field-label">Enter 6-digit code</span>
        <input
          type="text"
          pattern="[0-9]{6}"
          inputMode="numeric"
          placeholder="123456"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          className="wz-login-input"
        />
      </label>
      <div className="mt-1 flex justify-between gap-2">
        <button
          type="button"
          onClick={onBack}
          className="wz-login-link"
        >
          Edit email
        </button>
        <button
          type="submit"
          className="wz-login-primary"
          disabled={emailState.status === 'submitting-code' || emailState.status === 'sending-code'}
        >
          {emailState.status === 'submitting-code' ? 'Verifying…' : 'Verify & continue'}
        </button>
      </div>
    </form>
  )
}

type WalletId =
  | 'metamask'
  | 'coinbase_wallet'
  | 'base_account'
  | 'rainbow'
  | 'phantom'
  | 'zerion'
  | 'cryptocom'
  | 'uniswap'
  | 'okx_wallet'
  | 'bitget_wallet'
  | 'wallet_connect'
  | 'universal_profile'

const mobileWalletList: WalletId[] = [
  'metamask',
  'coinbase_wallet',
  'rainbow',
  'phantom',
  'okx_wallet',
  'bitget_wallet',
  'cryptocom',
  'uniswap',
  'wallet_connect',
]

const walletOptions: Array<{ id: WalletId; label: string; hint: string }> = [
  { id: 'metamask', label: 'MetaMask', hint: 'Browser Extension' },
  { id: 'coinbase_wallet', label: 'Coinbase Wallet', hint: 'App / Extension' },
  { id: 'base_account', label: 'Base Account', hint: 'App / Embedded' },
  { id: 'rainbow', label: 'Rainbow', hint: 'App / Extension' },
  { id: 'phantom', label: 'Phantom', hint: 'App / Extension' },
  { id: 'zerion', label: 'Zerion', hint: 'App / Extension' },
  { id: 'cryptocom', label: 'Crypto.com', hint: 'App / Extension' },
  { id: 'uniswap', label: 'Uniswap Wallet', hint: 'App / Extension' },
  { id: 'okx_wallet', label: 'OKX Wallet', hint: 'App / Extension' },
  { id: 'bitget_wallet', label: 'Bitget Wallet', hint: 'App / Extension' },
  { id: 'wallet_connect', label: 'WalletConnect', hint: 'Mobile fallback' },
  { id: 'universal_profile', label: 'Universal Profile', hint: 'Universal Profile' },
]

function WalletRow({
  label,
  onClick,
}: { label: string; onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="wz-login-option"
    >
      <span className="inline-flex items-center gap-3">
        <span className="inline-flex size-7 items-center justify-center rounded-full border border-white/10 bg-[rgba(255,198,71,0.08)] text-[#ffc647]">
          <WalletIcon size={16} />
        </span>
        {label}
      </span>
    </button>
  )
}

/* Scrollable wallet list ONLY (not whole modal) */
function WalletPickerScrollable({
  connectWith,
  onBack,
}: {
  connectWith: (w: WalletId) => Promise<void> | void
  onBack: () => void
}) {
  return (
    <div className="grid gap-2">
      <div className="wz-login-panel-note">Choose a wallet to continue</div>

      <div className="wz-login-wallet-list-wrap">
        <div className="wallet-scroll grid gap-2">
          {walletOptions.map((wallet) => (
            <WalletRow
              key={wallet.id}
              label={wallet.label}
              onClick={() => connectWith(wallet.id)}
            />
          ))}
        </div>
      </div>

      <button
        type="button"
        onClick={onBack}
        className="wz-login-link w-fit mt-1"
      >
        Back
      </button>
    </div>
  )
}

function GoogleButton({
  onClick,
  disabled,
}: {
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      className="wz-login-secondary wz-login-secondary--google"
      disabled={disabled}
      onClick={onClick}
      aria-label="Continue with Google"
    >
      <span className="wz-login-method-icon wz-login-method-icon--google" aria-hidden="true">
        <GoogleIcon size={18} />
      </span>
      <span className="wz-login-method-text">
        <span className="wz-login-method-title">Google</span>
      </span>
    </button>
  )
}

function IntraverseButton({
  onClick,
  disabled,
  loading,
}: {
  onClick: () => void
  disabled?: boolean
  loading?: boolean
}) {
  return (
    <button
      type="button"
      className="wz-login-secondary wz-login-secondary--intraverse"
      disabled={disabled}
      onClick={onClick}
      aria-label="Continue with Intraverse"
    >
      <span className="wz-login-method-icon wz-login-method-icon--intraverse" aria-hidden="true">
        <img
          src={intraverseLogo}
          alt=""
          className="wz-login-intraverse-logo"
        />
      </span>
      <span className="wz-login-method-text">
        <span className="wz-login-method-title">
          {loading ? 'Opening secure link…' : 'Intraverse'}
        </span>
      </span>
    </button>
  )
}

/* ============================== MAIN COMPONENT ============================== */
export default function LoginModal({
  open,
  onClose,
  logoSrc,
  leftLogoSrc,
  centerLogoSrc,
  rightLogoSrc,
}: LoginModalProps) {
  const dialogRef = useRef<HTMLDialogElement | null>(null)
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [emailStep, setEmailStep] = useState<'enter-email' | 'enter-code'>('enter-email')
  const [error, setError] = useState('')
  const [statusMessage, setStatusMessage] = useState('')
  const [privyInitTimedOut, setPrivyInitTimedOut] = useState(false)
  const privyConfigured = Boolean((import.meta as any).env?.VITE_PRIVY_APP_ID)

  // Which auth path user took (for create-wallet screen copy)
  const { ready, authenticated, user, logout } = usePrivy()
  const [loginMethod, setLoginMethod] = useState<'email' | 'oauth' | null>(deriveAuthMethodFromUser(user))

  // Toggle that replaces email + social UI with wallet list after clicking "Connect Wallet"
  const [walletMode, setWalletMode] = useState(false)
  const [debugLines, setDebugLines] = useState<string[]>([])
  const [showMobileContinue, setShowMobileContinue] = useState(false)

  // Email/social: embedded wallet is created automatically (no manual “Create wallet” step)
  const [creating, setCreating] = useState(false)
  const [intraverseLoading, setIntraverseLoading] = useState(false)
  const [walletFlowPending, setWalletFlowPending] = useState(false)
  const [walletFlowBusy, setWalletFlowBusy] = useState(false)
  const autoCreateEmbeddedRef = useRef(false)
  const retryCreateEmbeddedRef = useRef(false)
  const isMobileDevice =
    typeof navigator !== 'undefined' &&
    /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent)
  const walletFlowInFlightRef = useRef(false)
  const mobileConnectWatchdogRef = useRef<number | null>(null)
  const mobileContinuePendingTimerRef = useRef<number | null>(null)
  // When true, the open/close effect must NOT reopen the <dialog> and
  // onCancel must NOT call onClose. Set before closeDialogForPrivyFlow(),
  // cleared when the Privy flow finishes (success, error, or exit).
  const dialogSuppressedRef = useRef(false)
  // True while login() (Privy's full auth modal) is the active flow.
  const loginFlowActiveRef = useRef(false)
  // Keep a ref so async callbacks (onSuccess timers) can check current auth state without stale closure
  const authenticatedRef = useRef(authenticated)
  const debugEnabled = DEBUG_LOGIN_TRACE
  const pushDebug = useCallback((msg: string, data?: unknown) => {
    if (!debugEnabled) return
    const ts = new Date().toLocaleTimeString()
    let suffix = ''
    if (typeof data !== 'undefined') {
      try {
        suffix = ` ${JSON.stringify(data)}`
      } catch {
        suffix = ` ${String(data)}`
      }
    }
    const line = `${ts} ${msg}${suffix}`
    setDebugLines(prev => [...prev.slice(-79), line])
  }, [debugEnabled])

  const { createWallet } = useCreateWallet()
  const { wallets } = useWallets()
  const [existingAddress, setExistingAddress] = useState<string | undefined>(getPrimaryWalletAddress(user))
  const hasAnyWallet = Boolean(existingAddress)
  const activeWallet = wallets[0]
  const targetChainId = Number((import.meta as any).env?.VITE_ALLOWED_CHAIN_ID ?? 5031)

  const setFriendlyPrivyError = (errorCode: string | undefined, fallback?: string) => {
    const nextMessage = getFriendlyPrivyErrorMessage(errorCode, fallback)
    setStatusMessage('')
    setError(nextMessage)
  }

  const closeDialogForPrivyFlow = () => {
    dialogSuppressedRef.current = true
    try {
      if (dialogRef.current?.open) dialogRef.current.close()
    } catch {}
  }

  const reopenDialog = () => {
    dialogSuppressedRef.current = false
    try {
      if (open && dialogRef.current && !dialogRef.current.open) {
        dialogRef.current.showModal()
      }
    } catch {}
  }

  // Keep authenticatedRef in sync so async timer callbacks can read current value
  useEffect(() => { authenticatedRef.current = authenticated }, [authenticated])

  const clearMobileContinuePendingTimer = useCallback(() => {
    if (mobileContinuePendingTimerRef.current !== null) {
      window.clearTimeout(mobileContinuePendingTimerRef.current)
      mobileContinuePendingTimerRef.current = null
    }
  }, [])

  const clearMobileConnectWatchdog = useCallback(() => {
    if (mobileConnectWatchdogRef.current !== null) {
      window.clearTimeout(mobileConnectWatchdogRef.current)
      mobileConnectWatchdogRef.current = null
    }
  }, [])

  const startMobileConnectWatchdog = useCallback(() => {
    clearMobileConnectWatchdog()
    mobileConnectWatchdogRef.current = window.setTimeout(() => {
      if (authenticated) return
      pushDebug('mobile connect timeout: waiting for callback')
      setShowMobileContinue(true)
      setWalletFlowPending(false)
      setError('')
      setStatusMessage('')
      reopenDialog()
    }, 12000)
  }, [authenticated, clearMobileConnectWatchdog, pushDebug])

  // Social login
  const { initOAuth, loading: oauthLoading } = useLoginWithOAuth({
    onComplete: async () => {
      // Don’t close. Let effect below decide based on user+wallet.
      setLoginMethod('oauth')
    },
    onError: (err: any) => {
      const errStr = String(err?.message ?? err?.code ?? err)
      if (errStr.includes('exited_auth_flow')) {
        setError('')
        reopenDialog()
        return
      }
      setError(errStr || 'Google login failed')
      reopenDialog()
    },
  })

  // Email + OTP
  const { sendCode, loginWithCode, state: emailState } = useLoginWithEmail({
    onComplete: async () => {
      // Don’t close. Let effect below decide based on user+wallet.
      setLoginMethod('email')
    },
    onError: (err: any) => setError((err?.message ?? err?.code ?? String(err)) || 'Email login error'),
  })

  // Privy modal login (use for wallet auth so `authenticated` becomes true).
  // login() handles the full flow (connect + SIWE sign), so when onComplete fires
  // the user is fully authenticated — clear walletFlowPending so the auth effect
  // can close the modal normally instead of waiting for the redundant wallet flow.
  const { login } = useLogin({
    onComplete: ({ loginMethod }) => {
      pushDebug('privy:login onComplete', { loginMethod })
      loginFlowActiveRef.current = false
      walletFlowInFlightRef.current = false

      const isWalletLogin = loginMethod === 'siwe'
      if (isWalletLogin) {
        // Wallet login: trigger chain switch effect
        pushDebug('privy:login wallet auth done, triggering chain switch')
        setWalletFlowBusy(false)
        setWalletFlowPending(true)
      } else {
        // Email/Google: no chain switch needed
        setWalletFlowPending(false)
        setWalletFlowBusy(false)
      }
    },
    onError: (errorCode: any) => {
      pushDebug('privy:login onError', errorCode)
      loginFlowActiveRef.current = false
      setWalletFlowPending(false)
      setWalletFlowBusy(false)
      walletFlowInFlightRef.current = false
      setStatusMessage('')
      if (errorCode === 'exited_auth_flow' || String(errorCode).includes('exited_auth_flow')) {
        setError('')
        reopenDialog()
        return
      }
      const err = errorCode as { code?: number; details?: { eipCode?: number }; privyErrorCode?: string }
      if (err?.code === -32002 || err?.details?.eipCode === -32002) {
        setError('Wallet connection already pending. Check your wallet app or other browser tabs.')
        reopenDialog()
        return
      }
      const code =
        typeof err?.privyErrorCode === 'string'
          ? err.privyErrorCode
          : typeof errorCode === 'string'
            ? errorCode
            : String(errorCode)

      setFriendlyPrivyError(code, 'Failed to connect wallet')
      reopenDialog()
    },
  })

  const originInfo = getOriginInfo()
  // Match guess_the_ai_frontend: any window.ethereum counts as “injected” for gating + chain preflight.
  const hasInjectedWallet =
    typeof window !== 'undefined' &&
    Boolean((window as unknown as { ethereum?: unknown }).ethereum)

  const runEmbeddedWalletCreation = useCallback(async () => {
    setError('')
    setCreating(true)
    try {
      await createWallet()
    } catch (err: any) {
      setError(err?.message || 'Failed to create wallet')
      throw err
    } finally {
      setCreating(false)
    }
  }, [createWallet])

  const connectWith = async (wallet: WalletId) => {
    if (authDisabled) {
      setError('Login is still initializing. Please wait a few seconds and try again.')
      return
    }
    if (emailStep === 'enter-code') return
    setError('')
    setStatusMessage('')

    if (isMobileDevice && !isMobilePrivyOriginSupported()) {
      setError(
        `Mobile wallet login requires HTTPS or localhost. Current origin is ${originInfo.origin}. Add this domain in Privy allowed domains.`,
      )
      return
    }

    try {
      setWalletFlowPending(false)
      setWalletFlowBusy(true)
      pushDebug('connectWith: login() full wallet auth', { wallet })
      setShowMobileContinue(false)
      clearMobileConnectWatchdog()
      clearMobileContinuePendingTimer()
      closeDialogForPrivyFlow()
      loginFlowActiveRef.current = true
      login({ loginMethods: ['wallet'], walletChainType: 'ethereum-only' })
    } catch (err: any) {
      loginFlowActiveRef.current = false
      setWalletFlowPending(false)
      setWalletFlowBusy(false)
      console.error('connectWith error', err)
      setStatusMessage('')
      setError(err?.message || 'Failed to connect wallet')
      reopenDialog()
    }
  }

  const handleWalletButtonPress = async () => {
    if (authDisabled) {
      setError('Login is still initializing. Please wait a few seconds and try again.')
      return
    }
    if (emailStep === 'enter-code') return
    if (walletFlowBusy) return
    setError('')
    setStatusMessage('')

    if (isMobileDevice && !isMobilePrivyOriginSupported()) {
      pushDebug('walletPress:blocked unsupported mobile origin', originInfo)
      setError(
        `Mobile wallet login requires HTTPS or localhost. Current origin is ${originInfo.origin}. Use HTTPS tunnel and add this domain in Privy allowed domains.`
      )
      return
    }

    try {
      setWalletFlowPending(false)
      setWalletFlowBusy(true)
      setError('')
      setStatusMessage('Opening wallet selector…')
      trace('walletPress:start', { isMobileDevice, emailStep, authDisabled })
      pushDebug('walletPress:start', { isMobileDevice, emailStep, authDisabled })
      setShowMobileContinue(false)
      clearMobileConnectWatchdog()
      setTimeout(() => {
        closeDialogForPrivyFlow()
        trace('walletPress:privyModal')
        pushDebug('connect: privy modal wallet login')
        loginFlowActiveRef.current = true
        login({ loginMethods: ['wallet'], walletChainType: 'ethereum-only' })
      }, 150)
    } catch (err: any) {
      setWalletFlowPending(false)
      setWalletFlowBusy(false)
      trace('walletPress:error', err)
      pushDebug('walletPress:error', err?.message || String(err))
      clearMobileConnectWatchdog()
      setFriendlyPrivyError(
        err?.privyErrorCode ?? err?.code,
        err?.message || 'Failed to connect wallet'
      )
      reopenDialog()
    }
  }

  const handleMobileContinueLogin = useCallback(async () => {
    setError('')
    pushDebug('mobile continue login tapped')
    pushDebug('mobile continue:state snapshot', {
      walletsCount: Array.isArray(wallets) ? wallets.length : 0,
      activeWalletAddress: activeWallet?.address || null,
      wallets0Address: wallets[0]?.address || null,
      wallets0HasLoginOrLink: typeof (wallets[0] as any)?.loginOrLink === 'function',
      activeHasLoginOrLink: typeof (activeWallet as any)?.loginOrLink === 'function',
      authenticated: authenticatedRef.current,
    })

    // Guard: already authenticated — just close
    if (authenticatedRef.current) {
      pushDebug('mobile continue: already authenticated, closing')
      onClose?.()
      return
    }

    const attemptLoginOrLink = async (wallet: any, label: string): Promise<boolean> => {
      if (!wallet || typeof wallet.loginOrLink !== 'function') {
        pushDebug(`mobile continue: ${label}.loginOrLink not available`, {
          hasWallet: Boolean(wallet),
          address: wallet?.address,
          walletClientType: wallet?.walletClientType,
        })
        return false
      }
      try {
        pushDebug(`mobile continue: ${label}.loginOrLink start`, { address: wallet.address })
        setShowMobileContinue(false)
        setError('')
        setStatusMessage('')
        closeDialogForPrivyFlow()
        await wallet.loginOrLink()
        pushDebug(`mobile continue: ${label}.loginOrLink returned`, {
          authenticated: authenticatedRef.current,
        })
        if (authenticatedRef.current) {
          pushDebug(`mobile continue: ${label}.loginOrLink auth complete`)
          return true
        }
        // loginOrLink returned but auth not yet set — Privy may still be processing.
        // Set a watchdog: if auth doesn't resolve in 12 s, re-show the button.
        pushDebug(`mobile continue: ${label}.loginOrLink returned but auth pending, starting watchdog`)
        startMobileConnectWatchdog()
        return true
      } catch (err: any) {
        pushDebug(`mobile continue: ${label}.loginOrLink error`, err?.message || String(err))
        // If user exited, re-show the button so they can try again
        if (
          err?.privyErrorCode === 'exited_auth_flow' ||
          String(err?.message || '').includes('exited_auth_flow')
        ) {
          pushDebug(`mobile continue: ${label} exited_auth_flow, re-showing continue button`)
          setError('')
          setStatusMessage('')
          setShowMobileContinue(true)
          return true // handled
        }
        return false
      }
    }

    // Try loginOrLink on the first connected wallet
    const connected = wallets[0]
    if (await attemptLoginOrLink(connected, 'wallets[0]')) return

    // Try activeWallet if different from wallets[0]
    if (activeWallet && activeWallet !== connected) {
      if (await attemptLoginOrLink(activeWallet, 'activeWallet')) return
    }

    // No loginOrLink available on any connected wallet.
    // Do NOT call connectWallet() again — that causes an infinite loop back to this handler.
    // Instead re-trigger Privy's login() which will pick up the existing connection and
    // prompt only for the signature step needed to complete authentication.
    pushDebug('mobile continue: no loginOrLink on any wallet, re-triggering privy login modal', {
      walletsCount: Array.isArray(wallets) ? wallets.length : 0,
    })
    clearMobileContinuePendingTimer()
    setShowMobileContinue(false)
    setStatusMessage('')
    closeDialogForPrivyFlow()
    try {
      loginFlowActiveRef.current = true
      login({ loginMethods: ['wallet'], walletChainType: 'ethereum-only' })
    } catch (err: any) {
      loginFlowActiveRef.current = false
      pushDebug('mobile continue: privy login call error', err?.message || String(err))
      setStatusMessage('')
      setError('Failed to complete authentication. Please try again.')
      reopenDialog()
    }
  }, [wallets, activeWallet, login, clearMobileContinuePendingTimer, startMobileConnectWatchdog, pushDebug, onClose])

  const startIntraverseLogin = async () => {
    try {
      setError('')
      setStatusMessage('')
      setIntraverseLoading(true)
      pushDebug('intraverse:start')

      const response = await fetch(buildApiUrl('/intraverse/auth/magic-link'))
      const data = await response.json()
      pushDebug('intraverse:response', { ok: response.ok, success: data?.success })

      if (!response.ok || !data?.success || !data?.magicLoginUrl) {
        throw new Error(data?.message || 'Failed to start Intraverse login')
      }

      localStorage.setItem('intraversePendingAuthHash', data.authHash || '')
      localStorage.setItem('intraverseClientKey', data.clientKey || '')
      localStorage.setItem('intraverseMagicLoginUrl', data.magicLoginUrl)

      pushDebug('intraverse:redirect')
      window.location.assign(data.magicLoginUrl)
    } catch (err: any) {
      pushDebug('intraverse:error', err?.message || String(err))
      setError(err?.message || 'Failed to start Intraverse login')
      setIntraverseLoading(false)
    }
  }

  useEffect(() => {
    if (!open) {
      setPrivyInitTimedOut(false)
      return
    }
    if (!privyConfigured || ready) {
      setPrivyInitTimedOut(false)
      return
    }

    const timeoutId = window.setTimeout(() => {
      setPrivyInitTimedOut(true)
    }, 8000)

    return () => window.clearTimeout(timeoutId)
  }, [open, privyConfigured, ready])

  

  /* ————— Effects ————— */
  // Reset on open
  useEffect(() => {
    setError('')
    setStatusMessage('')
    setEmail('')
    setCode('')
    setEmailStep('enter-email')
    setWalletMode(false)
    setShowMobileContinue(false)
    clearMobileConnectWatchdog()
    clearMobileContinuePendingTimer()
    if (debugEnabled) {
      setDebugLines([])
      pushDebug('modal opened')
    }
    autoCreateEmbeddedRef.current = false
    retryCreateEmbeddedRef.current = false
    loginFlowActiveRef.current = false
    setWalletFlowPending(false)
    setWalletFlowBusy(false)
    setExistingAddress(getPrimaryWalletAddress(user))
    setLoginMethod(deriveAuthMethodFromUser(user))
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (authenticated) {
      clearMobileConnectWatchdog()
      clearMobileContinuePendingTimer()
      setShowMobileContinue(false)
      pushDebug('auth:authenticated true')
    }
  }, [authenticated, clearMobileConnectWatchdog, clearMobileContinuePendingTimer])

  useEffect(() => {
    pushDebug('auth:state', {
      ready,
      authenticated,
      activeWallet: activeWallet?.address || null,
      existingAddress: existingAddress || null,
    })
  }, [ready, authenticated, activeWallet, existingAddress, pushDebug])

  useEffect(() => {
    pushDebug('mobile continue visibility', { showMobileContinue })
  }, [showMobileContinue, pushDebug])

  // Open/close dialog — skip reopen while Privy flow has suppressed our dialog
  useEffect(() => {
    if (open && dialogRef.current && !dialogRef.current.open && !dialogSuppressedRef.current) {
      dialogRef.current.showModal()
    }
    if (!open) {
      dialogSuppressedRef.current = false
      if (dialogRef.current?.open) dialogRef.current.close()
    }
    return () => { try { if (dialogRef.current?.open) dialogRef.current.close() } catch {} }
  }, [open])

  // Recompute address + login method when user updates
  useEffect(() => {
    setExistingAddress(getPrimaryWalletAddress(user))
    // If loginMethod wasn’t set by hooks, derive it from the user object
    setLoginMethod((prev) => prev ?? deriveAuthMethodFromUser(user))
    pushDebug('user:update', {
      linkedAccounts: user?.linkedAccounts?.length ?? 0,
      hasWalletOnUser: Boolean((user as any)?.wallet?.address),
      hasEmbeddedWallets: Boolean((user as any)?.embeddedWallets?.length),
      derivedAddress: getPrimaryWalletAddress(user) || null,
    })
  }, [user])

  // Single source of truth: decide create-wallet vs close after auth
  useEffect(() => {
    if (!ready || !authenticated) return
    const currentAddress = getPrimaryWalletAddress(user)
    pushDebug('auth:post-login check', {
      ready,
      authenticated,
      currentAddress: currentAddress || null,
      walletFlowPending,
    })
    if (currentAddress) {
      setExistingAddress(currentAddress)
      if (walletFlowPending) {
        pushDebug('auth:address present but walletFlowPending')
        return
      }
      // Wallet exists → close
      pushDebug('auth:address present closing modal')
      dialogSuppressedRef.current = false
      onClose?.()
      return
    }
    // No wallet yet → keep modal open; email/social triggers auto createWallet in separate effect.
    // Make sure dialog is visible so user can see the "creating wallet" state.
    pushDebug('auth:no address keep modal open, ensuring dialog visible')
    setLoginMethod((prev) => prev ?? deriveAuthMethodFromUser(user) ?? 'email')
    if (dialogSuppressedRef.current) {
      reopenDialog()
    }
  }, [ready, authenticated, user, onClose])

  // Wallet flow: after Privy wallet auth, switch chain to 0G and close.
  // Privy already handled proof-of-ownership (SIWE), no extra personal_sign needed.
  useEffect(() => {
    if (!open || !ready || !authenticated || !walletFlowPending) return
    if (!activeWallet?.address) return
    if (walletFlowInFlightRef.current) return
    pushDebug('walletFlow:begin', { address: activeWallet?.address })

    walletFlowInFlightRef.current = true

    void (async () => {
      try {
        setWalletFlowBusy(true)
        setError('')
        setStatusMessage('Switching to 0G network…')

        // Switch chain via window.ethereum directly (more reliable than Privy's switchChain)
        const provider = (window as Window & { ethereum?: any }).ethereum
        if (provider?.request) {
          const chainHex = `0x${targetChainId.toString(16)}`
          try {
            const currentChain = await provider.request({ method: 'eth_chainId' })
            if (typeof currentChain === 'string' && currentChain.toLowerCase() !== chainHex.toLowerCase()) {
              try {
                await provider.request({
                  method: 'wallet_switchEthereumChain',
                  params: [{ chainId: chainHex }],
                })
              } catch (switchErr: any) {
                if (switchErr?.code === 4902) {
                  await provider.request({
                    method: 'wallet_addEthereumChain',
                    params: [{
                      chainId: chainHex,
                      chainName: '0G Mainnet',
                      nativeCurrency: { name: '0G', symbol: '0G', decimals: 18 },
                      rpcUrls: ['https://evmrpc.0g.ai'],
                      blockExplorerUrls: ['https://chainscan.0g.ai'],
                    }],
                  })
                }
              }
            }
            pushDebug('walletFlow:chainSwitch done')
          } catch {
            pushDebug('walletFlow:chainSwitch skipped')
          }
        }

        setWalletFlowPending(false)
        setStatusMessage('')
        dialogSuppressedRef.current = false
        onClose?.()
      } catch (err: any) {
        pushDebug('walletFlow:error', err?.message || String(err))
        setError(err?.message || 'Failed to complete wallet setup.')
        setStatusMessage('')
        setWalletFlowPending(false)
        reopenDialog()
      } finally {
        setWalletFlowBusy(false)
        walletFlowInFlightRef.current = false
      }
    })()
  }, [open, ready, authenticated, walletFlowPending, activeWallet, targetChainId, onClose])

  // Auto-create embedded wallet after email / Google login (Privy createOnLogin may lag behind custom UI)
  useEffect(() => {
    if (!open || !ready || !authenticated || !user) return
    if (getPrimaryWalletAddress(user)) return
    if (!isEmailOrSocialPrivyUser(user)) return
    if (autoCreateEmbeddedRef.current) return
    pushDebug('embedded:auto-create start')
    autoCreateEmbeddedRef.current = true
    void runEmbeddedWalletCreation().catch(() => {
      pushDebug('embedded:auto-create failed')
      autoCreateEmbeddedRef.current = false
    })
  }, [open, ready, authenticated, user, runEmbeddedWalletCreation])

  // Safety retry: on some sessions Privy wallet provisioning can lag after OTP/OAuth auth.
  // Retry createWallet once if no wallet address is still present shortly after first attempt.
  useEffect(() => {
    if (!open || !ready || !authenticated || !user) return
    if (getPrimaryWalletAddress(user)) return
    if (!isEmailOrSocialPrivyUser(user)) return
    if (creating || retryCreateEmbeddedRef.current) return

    retryCreateEmbeddedRef.current = true
    pushDebug('embedded:retry scheduled')
    const timeoutId = window.setTimeout(() => {
      pushDebug('embedded:retry running')
      void runEmbeddedWalletCreation().catch(() => {
        // keep existing error surfaced by runEmbeddedWalletCreation
        pushDebug('embedded:retry failed')
      })
    }, 1800)

    return () => window.clearTimeout(timeoutId)
  }, [open, ready, authenticated, user, creating, runEmbeddedWalletCreation])

  // Handlers for forms
  const onEmailSubmit: React.FormEventHandler<HTMLFormElement> = async (e) => {
    e.preventDefault()
    setError('')
    setStatusMessage('')
    pushDebug('email:sendCode start', { emailLength: email.trim().length })
    if (!ready) {
      pushDebug('email:sendCode blocked not ready')
      setError('Login is still initializing. Please wait a few seconds and try again.')
      return
    }
    try {
      setLoginMethod('email')
      await sendCode({ email })
      pushDebug('email:sendCode success')
      setEmailStep('enter-code')
      setWalletMode(false) // ensure wallets panel is hidden while entering code
    } catch (err: any) {
      pushDebug('email:sendCode error', err?.message || String(err))
      setError(err?.message || 'Failed to send code')
    }
  }

  const onCodeSubmit: React.FormEventHandler<HTMLFormElement> = async (e) => {
    e.preventDefault()
    setError('')
    setStatusMessage('')
    pushDebug('email:verifyCode start', { codeLength: code.trim().length })
    if (!ready) {
      pushDebug('email:verifyCode blocked not ready')
      setError('Login is still initializing. Please wait a few seconds and try again.')
      return
    }
    try {
      await loginWithCode({ code })
      pushDebug('email:verifyCode success')
    } catch (err: any) {
      pushDebug('email:verifyCode error', err?.message || String(err))
      setError(err?.message || 'Invalid code')
    }
  }

  // UI rules
  const showCustomCreateUI = Boolean(authenticated && !hasAnyWallet)
  const showPrivyLoadingState = privyConfigured && !ready
  const authDisabled = !ready || !privyConfigured

  // Unified close handler: if user is authenticated but lacks a wallet
  // (embedded wallet still provisioning), closing should log them out.
  const requestClose = () => {
    // While Privy's login/wallet modal is on screen, ignore browser cancel
    // events that bleed through to our hidden <dialog>.
    if (dialogSuppressedRef.current) {
      pushDebug('modal:requestClose suppressed (privy flow active)')
      return
    }
    pushDebug('modal:requestClose', { showCustomCreateUI, authenticated })
    if (showCustomCreateUI && authenticated) {
      logout().catch(() => {})
    }
    try { if (dialogRef.current?.open) dialogRef.current.close() } catch {}
    onClose?.()
  }

  // Don’t render the dialog at all when closed so it can’t appear off‑center.
  if (!open) return null

  return (
    <dialog
      ref={dialogRef}
      onCancel={requestClose}
      className="wz-login-modal"
      aria-labelledby="wz-login-title"
    >
      <div className="wz-login-shell">
        <div className="wz-login-card">
          {(centerLogoSrc ?? logoSrc) && (
            <div className="wz-login-crest-shell">
              <img
                src={centerLogoSrc ?? logoSrc}
                alt=""
                className="wz-login-crest"
              />
            </div>
          )}

          <div className="wz-login-scroll">
            <button
              type="button"
              onClick={requestClose}
              aria-label="Close"
              className="wz-login-close"
            >
              ×
            </button>

            <HeaderLogos leftLogoSrc={leftLogoSrc} rightLogoSrc={rightLogoSrc} />
            <TitleCard />
            <ErrorBanner error={error} />
            {statusMessage && !error && (
              <div className="wz-login-alert wz-login-alert--neutral">
                {statusMessage}
              </div>
            )}
            {debugEnabled && (
              <div className="wz-login-alert wz-login-alert--neutral">
                <div style={{ fontWeight: 700, marginBottom: 6 }}>Debug trace (mobile-visible)</div>
                <div style={{ marginBottom: 6, fontSize: 11, opacity: 0.85 }}>
                  {`status: ready=${ready} auth=${authenticated} walletFlowPending=${walletFlowPending} walletFlowBusy=${walletFlowBusy} activeWallet=${activeWallet?.address ?? 'none'} existing=${existingAddress ?? 'none'} emailStep=${emailStep} method=${loginMethod ?? 'none'} protocol=${originInfo.protocol} host=${originInfo.hostname}`}
                </div>
                <div style={{ maxHeight: 140, overflowY: 'auto', fontSize: 12, lineHeight: 1.35, whiteSpace: 'pre-wrap' }}>
                  {debugLines.length > 0
                    ? debugLines.map((line, idx) => <div key={`${idx}-${line}`}>{line}</div>)
                    : <div>No debug events yet.</div>}
                </div>
              </div>
            )}
            {!privyConfigured && (
              <div className="wz-login-alert wz-login-alert--error">
                Login is not configured because `VITE_PRIVY_APP_ID` is missing in this environment.
              </div>
            )}
            {showPrivyLoadingState && (
              <div className="wz-login-alert wz-login-alert--neutral">
                {privyInitTimedOut
                  ? 'Login is taking longer than expected to initialize. Please refresh once and check that the Privy app is configured for this site domain.'
                  : 'Initializing login...'}
              </div>
            )}
            <EmbeddedWalletBadge address={authenticated ? existingAddress : undefined} />

            {showCustomCreateUI ? (
              <div className="grid gap-3">
                <div className="wz-login-alert wz-login-alert--neutral">
                  {creating
                    ? 'Creating your wallet…'
                    : isEmailOrSocialPrivyUser(user)
                      ? 'Finishing setup…'
                      : 'Completing sign-in…'}
                </div>
                {!creating && error ? (
                  <button
                    type="button"
                    className="wz-login-primary"
                    onClick={() => {
                      autoCreateEmbeddedRef.current = false
                      void runEmbeddedWalletCreation().catch(() => {
                        autoCreateEmbeddedRef.current = false
                      })
                    }}
                  >
                    Try again
                  </button>
                ) : null}
              </div>
            ) : (
              <div className="grid gap-3">
                {!authenticated && (
                  <>
                    {showMobileContinue && (
                      <button
                        type="button"
                        className="wz-login-primary"
                        onClick={() => { void handleMobileContinueLogin() }}
                      >
                        Continue Login
                      </button>
                    )}
                    {!walletMode ? (
                      <>
                        {emailStep === 'enter-email' ? (
                          <EmailForm
                            email={email}
                            setEmail={setEmail}
                            emailState={emailState}
                            onEmailSubmit={onEmailSubmit}
                            setLoginMethod={setLoginMethod}
                            disabled={authDisabled}
                          />
                        ) : (
                          <CodeForm
                            code={code}
                            setCode={setCode}
                            onBack={() => {
                              setError('')
                              setCode('')
                              setEmail('')
                              setLoginMethod(null)
                              setEmailStep('enter-email')
                            }}
                            onCodeSubmit={onCodeSubmit}
                            emailState={emailState}
                          />
                        )}

                        <DividerOr />

                        {/* CONNECT WALLET triggers Privy wallet login to create an authenticated session */}
                        <button
                          type="button"
                          className="wz-login-primary wz-login-primary--wallet"
                          onClick={handleWalletButtonPress}
                          disabled={emailStep === 'enter-code' || authDisabled || walletFlowBusy}
                        >
                          <span className="wz-login-wallet-row">
                            <span className="wz-login-wallet-icon" aria-hidden="true">
                              <WalletIcon size={18} />
                            </span>
                            <span className="wz-login-wallet-text">
                              <span className="wz-login-wallet-title">Connect wallet</span>
                            </span>
                          </span>
                        </button>
{/* 
                      <IntraverseButton
                        disabled={emailStep === 'enter-code' || intraverseLoading}
                        loading={intraverseLoading}
                        onClick={startIntraverseLogin}
                      /> */}

                      <GoogleButton
                        disabled={oauthLoading || emailStep === 'enter-code' || authDisabled || intraverseLoading}
                        onClick={() => {
                          setStatusMessage('')
                          if (authDisabled) {
                            pushDebug('oauth:blocked not ready')
                            setError('Login is still initializing. Please wait a few seconds and try again.')
                            return
                          }
                          if (emailStep === 'enter-code') return
                          pushDebug('oauth:start google')
                          setError('')
                          setLoginMethod('oauth')
                          setStatusMessage('Opening Google sign-in…')
                          setTimeout(() => {
                            closeDialogForPrivyFlow()
                            initOAuth({ provider: 'google' })
                          }, 150)
                        }}
                      />
                      </>
                    ) : (
                      <WalletPickerScrollable
                        connectWith={connectWith}
                        onBack={() => setWalletMode(false)}
                      />
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </dialog>
  )
}

// Extend window type locally
declare global {
  interface Window { ethereum?: any }
}




// functionality 1 

// import React, { useEffect, useRef, useState } from 'react'
// import {
//   useConnectWallet,
//   useLoginWithEmail,
//   useLoginWithOAuth,
//   usePrivy,
//   useCreateWallet,
// } from '@privy-io/react-auth'

// import zeroGLogo from '../assets/OG.png'
// import kultGameLogo from '../assets/kultLogo.png'
// import MyLogo from '../assets/logo.png'

// /* ============================== Icons ============================== */
// const WalletIcon = ({ size = 18 }: { size?: number }) => (
//   <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
//     <path d="M3.75 7.5h13.5a3 3 0 0 1 3 3v6.75a3 3 0 0 1-3 3H6.75a3 3 0 0 1-3-3V9.75a2.25 2.25 0 0 1 2.25-2.25Z" stroke="currentColor" strokeWidth="1.6"/>
//     <path d="M18.75 12.75h-2.25a1.5 1.5 0 1 0 0 3h2.25a.75.75 0 0 0 .75-.75v-1.5a.75.75 0 0 0-.75-.75Z" fill="currentColor"/>
//     <path d="M17.25 5.25H6a2.25 2.25 0 0 0-2.25 2.25v1.5" stroke="currentColor" strokeWidth="1.6"/>
//   </svg>
// )


// const GoogleIcon = ({ size = 18 }: { size?: number }) => (
//   <svg width={size} height={size} viewBox="0 0 24 24">
//     <path fill="#4285F4" d="M23.6 12.3c0-.8-.1-1.6-.2-2.3H12v4.4h6.5c-.3 1.6-1.3 3-2.7 3.9v3.2h4.4c2.6-2.3 4.1-5.6 4.1-9.2z"/>
//     <path fill="#34A853" d="M12 24c3.6 0 6.6-1.2 8.8-3.2l-4.4-3.2c-1.2.8-2.7 1.3-4.4 1.3-3.4 0-6.2-2.3-7.2-5.3H.2v3.3C2.3 21.3 6.8 24 12 24z"/>
//     <path fill="#FBBC05" d="M4.8 13.6c-.3-1-.3-2 0-3V7.3H.2C-1 9.6-1 12.4.2 14.7l4.6-1.1z"/>
//     <path fill="#EA4335" d="M12 4.7c1.9 0 3.6.7 4.9 1.9l3.7-3.7C18.6 1 15.6 0 12 0 6.8 0 2.3 2.7.2 7.3l4.6 3.3C5.8 7.1 8.6 4.7 12 4.7z"/>
//   </svg>
// )

// /* ============================== Types ============================== */
// type LoginModalProps = {
//   open: boolean
//   onClose: () => void
//   logoSrc?: string
//   leftLogoSrc?: string
//   centerLogoSrc?: string
//   rightLogoSrc?: string
// }

// /* ============================== Small Components ============================== */
// function HeaderLogos({
//   leftLogoSrc,
//   rightLogoSrc,
// }: { leftLogoSrc?: string; rightLogoSrc?: string }) {
//   return (
//     <>
//       {leftLogoSrc && (
//         <img
//           src={leftLogoSrc}
//           alt="Left logo"
//           className="fixed left-3 top-3 z-[60] w-30 m-3 rounded-md border border-[#222] object-contain pointer-events-none"
//         />
//       )}
//       {rightLogoSrc && (
//         <img
//           src={rightLogoSrc}
//           alt="Right logo"
//           className="fixed right-3 top-3 z-[60] w-24 m-3 rounded-md border border-[#222] object-contain pointer-events-none"
//         />
//       )}
//     </>
//   )
// }

// function TitleCard() {
//   return (
//     <div className="relative overflow-hidden rounded-2xl bg-gradient-to-b from-cyan-400/10 to-transparent pt-8 pb-5 text-center mb-3">
//       <div className="pointer-events-none absolute -inset-20 bg-[radial-gradient(900px_220px_at_50%_-20%,rgba(34,193,241,0.25),transparent)]" />
//       <div className="relative z-10">
//         <h2 className="text-3xl md:text-4xl font-extrabold tracking-wider bg-gradient-to-r from-cyan-300 via-sky-400 to-blue-500 bg-clip-text text-transparent drop-shadow-[0_2px_16px_rgba(0,160,255,0.35)]">
//           WELCOME
//         </h2>
//         <div className="mx-auto mt-2 h-1 w-24 rounded-full bg-gradient-to-r from-transparent via-white/40 to-transparent" />
//       </div>
//     </div>
//   )
// }

// function ErrorBanner({ error }: { error?: string }) {
//   if (!error) return null
//   return (
//     <div className="my-2 rounded-lg bg-[#2a0e0e] px-3 py-2 text-sm text-[#ffd8d8]">
//       {error}
//     </div>
//   )
// }

// function EmbeddedWalletBadge({ address }: { address?: string }) {
//   if (!address) return null
//   return (
//     <div className="mb-3 rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-xs text-white/80 break-all">
//       Wallet: <span className="font-mono text-[11px] text-white/95">{address}</span>
//     </div>
//   )
// }

// function DividerOr() {
//   return (
//     <div className="my-1 grid grid-cols-[1fr_auto_1fr] items-center gap-2 text-[#9CB9D0]">
//       <span className="h-px bg-gradient-to-r from-transparent via-white/25 to-transparent" />
//       <span className="text-xs">or</span>
//       <span className="h-px bg-gradient-to-r from-transparent via-white/25 to-transparent" />
//     </div>
//   )
// }

// function EmailForm({
//   email,
//   setEmail,
//   emailState,
//   onEmailSubmit,
//   setLoginMethod,
//   disabled,
// }: {
//   email: string
//   setEmail: (s: string) => void
//   emailState: ReturnType<typeof useLoginWithEmail>['state']
//   onEmailSubmit: React.FormEventHandler<HTMLFormElement>
//   setLoginMethod: (m: 'email' | 'oauth' | null) => void
//   disabled: boolean
// }) {
//   return (
//     <form className="grid gap-3" onSubmit={onEmailSubmit}>
//       <label className="grid gap-2">
//         <span className="text-sm text-white/70">Email address</span>
//         <input
//           type="email"
//           required
//           placeholder="you@example.com"
//           value={email}
//           onChange={(e) => setEmail(e.target.value)}
//           className="rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-base text-white/95 placeholder-white/40 outline-none focus:ring-2 focus:ring-cyan-400/40 focus:border-white/30 transition"
//           disabled={disabled}
//         />
//       </label>
//       <div className="mt-1">
//         <button
//           type="submit"
//           className="inline-flex w-full items-center justify-center rounded-2xl border border-fuchsia-400/50 bg-gradient-to-tr from-fuchsia-500 to-violet-500 px-5 py-3 font-bold text-white shadow-[0_10px_28px_rgba(217,70,239,0.35)] hover:shadow-[0_14px_34px_rgba(217,70,239,0.45)] active:scale-[.98] disabled:opacity-60"
//           disabled={
//             disabled ||
//             emailState.status === 'sending-code' ||
//             emailState.status === 'submitting-code'
//           }
//           onClick={() => setLoginMethod('email')}
//         >
//           {emailState.status === 'sending-code' ? 'Sending…' : 'Send code'}
//         </button>
//       </div>
//     </form>
//   )
// }

// function CodeForm({
//   code,
//   setCode,
//   onBack,
//   onCodeSubmit,
//   emailState,
// }: {
//   code: string
//   setCode: (s: string) => void
//   onBack: () => void
//   onCodeSubmit: React.FormEventHandler<HTMLFormElement>
//   emailState: ReturnType<typeof useLoginWithEmail>['state']
// }) {
//   return (
//     <form className="grid gap-3" onSubmit={onCodeSubmit}>
//       <label className="grid gap-2">
//         <span className="text-sm text-[#9CB9D0]">Enter 6-digit code</span>
//         <input
//           type="text"
//           pattern="[0-9]{6}"
//           inputMode="numeric"
//           placeholder="123456"
//           value={code}
//           onChange={(e) => setCode(e.target.value)}
//           className="rounded-xl border border-white/20 bg-white/5 px-4 py-3 text-base text-[#EAF6FF] outline-none focus:ring-2 focus:ring-cyan-400/50"
//         />
//       </label>
//       <div className="mt-1 flex justify-between gap-2">
//         <button
//           type="button"
//           onClick={onBack}
//           className="rounded-xl border border-transparent px-3 py-2.5 text-[#9CB9D0] hover:text-white"
//         >
//           Edit email
//         </button>
//         <button
//           type="submit"
//           className="inline-flex items-center justify-center rounded-2xl border border-fuchsia-400/50 bg-gradient-to-tr from-fuchsia-500 to-violet-500 px-5 py-3 font-bold text-white shadow-[0_10px_28px_rgba(217,70,239,0.35)] hover:shadow-[0_14px_34px_rgba(217,70,239,0.45)] active:scale-[.98] disabled:opacity-60"
//           disabled={emailState.status === 'submitting-code' || emailState.status === 'sending-code'}
//         >
//           {emailState.status === 'submitting-code' ? 'Verifying…' : 'Verify & continue'}
//         </button>
//       </div>
//     </form>
//   )
// }

// type WalletId =
//   | 'metamask'
//   | 'coinbase_wallet'
//   | 'okx_wallet'

// function WalletRow({
//   label,
//   hint,
//   onClick,
// }: { label: string; hint?: string; onClick?: () => void }) {
//   return (
//     <button
//       type="button"
//       onClick={onClick}
//       className="w-full inline-flex items-center justify-between rounded-2xl border border-white/15 bg-gradient-to-r from-[#0b122a] via-[#111a39] to-[#0b122a] px-4 py-3 text-white/95 hover:bg-white/10"
//     >
//       <span className="inline-flex items-center gap-2">
//         <span className="inline-flex size-6 items-center justify-center rounded-full bg-white/10">
//           <WalletIcon />
//         </span>
//         {label}
//       </span>
//       {hint ? <span className="text-xs opacity-70">{hint}</span> : null}
//     </button>
//   )
// }

// /* Scrollable wallet list ONLY (not whole modal) */
// function WalletPickerScrollable({
//   connectWith,
//   onBack,
// }: {
//   connectWith: (w: WalletId) => Promise<void> | void
//   onBack: () => void
// }) {
//   return (
//     <div className="grid gap-2">
//       <div className="rounded-xl border border-white/15 bg-white/5 p-3 text-sm text-white/80">
//         Choose a wallet to continue
//       </div>

//       <div className="max-h-[48vh] overflow-y-auto pr-1">
//         <style>{`
//           .wallet-scroll::-webkit-scrollbar { width: 8px; }
//           .wallet-scroll::-webkit-scrollbar-track { background: rgba(255,255,255,0.06); border-radius: 9999px; }
//           .wallet-scroll::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.25); border-radius: 9999px; }
//           .wallet-scroll:hover::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.35); }
//         `}</style>
//         <div className="wallet-scroll grid gap-2">
//           <WalletRow label="MetaMask" hint="Browser Extension" onClick={() => connectWith('metamask')} />
//           <WalletRow label="Coinbase Wallet" hint="App / Extension" onClick={() => connectWith('coinbase_wallet')} />
//           {/* <WalletRow label="Bitget" hint="App / Extension" onClick={() => connectWith('bitget')} /> */}
//           <WalletRow label="OKX" hint="App / Extension" onClick={() => connectWith('okx_wallet')} />
//         </div>
//       </div>

//       <button
//         type="button"
//         onClick={onBack}
//         className="mt-1 text-sm text-white/80 hover:text-white underline underline-offset-4"
//       >
//         Back
//       </button>
//     </div>
//   )
// }

// function GoogleButton({
//   onClick,
//   disabled,
// }: {
//   onClick: () => void
//   disabled?: boolean
// }) {
//   return (
//     <button
//       className="flex w-full items-center justify-center rounded-2xl border border-white/15 bg-white/5 px-4 py-3 font-semibold text-white/95 hover:bg-white/10 disabled:opacity-50"
//       disabled={disabled}
//       onClick={onClick}
//       aria-label="Continue with Google"
//     >
//       <GoogleIcon />
//       <span className="ml-2">Google</span>
//     </button>
//   )
// }

// function CreateWalletPanel({
//   variant,
//   creating,
//   onCreate,
// }: {
//   variant: 'email' | 'oauth'
//   creating: boolean
//   onCreate: () => void
// }) {
//   const copy = variant === 'email' ? 'Continue with your email session.' : 'Continue with your Google session.'
//   const color =
//     variant === 'email'
//       ? 'border-fuchsia-400/50 bg-gradient-to-tr from-fuchsia-500 to-violet-500'
//       : 'border-emerald-400/50 bg-gradient-to-tr from-emerald-400 via-teal-400 to-cyan-500'

//   return (
//     <div className="grid gap-4">
//       <div className="rounded-xl bg-amber-500/10 border border-amber-400/30 px-4 py-3 text-sm text-amber-50/90">
//         You don’t have a wallet address yet. We’ll create one now to continue.
//       </div>
//       <div className="rounded-xl border border-white/10 bg-white/5 p-4">
//         <div className="text-sm text-white/80 mb-3">{copy}</div>
//         <button
//           onClick={onCreate}
//           disabled={creating}
//           className={`inline-flex w-full items-center justify-center rounded-2xl ${color} px-5 py-3 font-bold text-white shadow-[0_10px_28px_rgba(16,185,129,0.25)] active:scale-[.98] disabled:opacity-60`}
//         >
//           {creating ? 'Creating wallet…' : 'Create wallet'}
//         </button>
//       </div>

//       {/* Keep other paths disabled while creating wallet is required */}
//       <div className="grid gap-2 opacity-60">
//         <div className="grid gap-2">
//           <WalletRow label="MetaMask" />
//           <WalletRow label="Coinbase Wallet" />
//           {/* <WalletRow label="Bitget" /> */}
//           <WalletRow label="OKX" />
//           {/* <WalletRow label="WalletConnect (QR)" /> */}
//         </div>
//         <GoogleButton onClick={() => {}} disabled />
//       </div>
//     </div>
//   )
// }

// /* ============================== MAIN COMPONENT ============================== */
// export default function LoginModal({
//   open,
//   onClose,
//   logoSrc,
//   leftLogoSrc = kultGameLogo,
//   centerLogoSrc = MyLogo,
//   rightLogoSrc = zeroGLogo,
// }: LoginModalProps) {
//   const dialogRef = useRef<HTMLDialogElement | null>(null)
//   const [email, setEmail] = useState('')
//   const [code, setCode] = useState('')
//   const [emailStep, setEmailStep] = useState<'enter-email' | 'enter-code'>('enter-email')
//   const [error, setError] = useState('')

//   // Which auth path user took (for create-wallet screen copy)
//   const [loginMethod, setLoginMethod] = useState<'email' | 'oauth' | null>(null)

//   // Toggle that replaces email + social UI with wallet list after clicking "Connect Wallet"
//   const [walletMode, setWalletMode] = useState(false)

//   // If logged in (email/oauth) but no wallet — ask to create with our custom UI
//   const [needsWallet, setNeedsWallet] = useState(false)
//   const [creating, setCreating] = useState(false)

//   const { ready, authenticated, user } = usePrivy()
//   const { createWallet } = useCreateWallet()

//   const existingAddress =
//     (user as any)?.wallet?.address ??
//     (user as any)?.embeddedWallets?.[0]?.address ??
//     (user as any)?.wallets?.[0]?.address
//   const hasAnyWallet = Boolean(existingAddress)

//   // External wallet connect
//   const { connectWallet } = useConnectWallet({
//     onSuccess: () => onClose?.(),
//     onError: (err: any) => setError((err?.message ?? err?.code ?? String(err)) || 'Failed to connect wallet'),
//   })

//   // Social login
//   const { initOAuth, loading: oauthLoading } = useLoginWithOAuth({
//     onComplete: async () => {
//       if (!hasAnyWallet) {
//         setLoginMethod('oauth')
//         setNeedsWallet(true) // keep modal open and ask to create wallet
//         return
//       }
//       onClose?.()
//     },
//     onError: (err: any) => setError((err?.message ?? err?.code ?? String(err)) || 'OAuth error'),
//   })

//   // Email + OTP
//   const { sendCode, loginWithCode, state: emailState } = useLoginWithEmail({
//     onComplete: async () => {
//       if (!hasAnyWallet) {
//         setLoginMethod('email')
//         setNeedsWallet(true)
//         return
//       }
//       onClose?.()
//     },
//     onError: (err: any) => setError((err?.message ?? err?.code ?? String(err)) || 'Email login error'),
//   })

//   // Create embedded wallet with our own UI (no Privy modal UI)
//   const handleCreateEmbeddedWallet = async () => {
//     setError('')
//     setCreating(true)
//     try {
//       await createWallet()
//       setNeedsWallet(false)
//       onClose?.()
//     } catch (err: any) {
//       setError(err?.message || 'Failed to create wallet')
//     } finally {
//       setCreating(false)
//     }
//   }

//   const connectWith = async (wallet: WalletId) => {
//     try {
//       try { if (dialogRef.current?.open) dialogRef.current.close() } catch {}
//       onClose?.()
//       await connectWallet({ walletList: [wallet], walletChainType: 'ethereum-only' })
//     } catch (err: any) {
//       console.error('connectWith error', err)
//       setError(err?.message || 'Failed to connect wallet')
//     }
//   }

//   useEffect(() => {
//     setError('')
//     setEmail('')
//     setCode('')
//     setEmailStep('enter-email')
//     setLoginMethod(null)
//     setNeedsWallet(false)
//     setWalletMode(false)
//   }, [open])

//   useEffect(() => {
//     if (open && dialogRef.current && !dialogRef.current.open) dialogRef.current.showModal()
//     if (!open && dialogRef.current?.open) dialogRef.current.close()
//     return () => { try { if (dialogRef.current?.open) dialogRef.current.close() } catch {} }
//   }, [open])

//   useEffect(() => {
//     if (ready && authenticated) {
//       if (!hasAnyWallet && loginMethod) setNeedsWallet(true)
//       if (hasAnyWallet) setNeedsWallet(false)
//     }
//   }, [ready, authenticated, hasAnyWallet, loginMethod])

//   const onEmailSubmit: React.FormEventHandler<HTMLFormElement> = async (e) => {
//     e.preventDefault()
//     setError('')
//     try {
//       setLoginMethod('email')
//       await sendCode({ email })
//       setEmailStep('enter-code')
//       setWalletMode(false) 
//     } catch (err: any) {
//       setError(err?.message || 'Failed to send code')
//     }
//   }

//   const onCodeSubmit: React.FormEventHandler<HTMLFormElement> = async (e) => {
//     e.preventDefault()
//     setError('')
//     try {
//       await loginWithCode({ code })
//     } catch (err: any) {
//       setError(err?.message || 'Invalid code')
//     }
//   }

//   // UI rules
//   const showCustomCreateUI = needsWallet && authenticated && !hasAnyWallet
//   const authOptionsDisabled = emailStep === 'enter-code' || showCustomCreateUI

//   return (
//     <dialog
//       ref={dialogRef}
//       onCancel={onClose}
//       className="fixed inset-0 z-50 m-auto w-[92vw] max-w-[500px] max-h-[92dvh] overflow-visible rounded-2xl border border-white/10 bg-[rgba(10,16,34,0.70)] shadow-[0_30px_80px_rgba(0,0,0,0.55)] p-0"
//     >
//       <HeaderLogos leftLogoSrc={leftLogoSrc} rightLogoSrc={rightLogoSrc} />

//       <div className="relative p-6 pt-10 md:pt-10 text-[#EAF6FF] bg-gradient-to-b from-[rgba(10,16,34,0.75)] to-[rgba(8,16,34,0.45)]">
//         {(centerLogoSrc ?? logoSrc) && (
//           <img
//             src={centerLogoSrc ?? logoSrc}
//             alt="Center logo"
//             className="absolute left-1/2 -top-8 md:-top-10 -translate-x-1/2 z-20 w-26 md:w-34 rounded-xl border border-[#222] object-contain"
//           />
//         )}

//         <button
//           type="button"
//           onClick={onClose}
//           aria-label="Close"
//           className="absolute right-3 top-2 text-2xl leading-none text-slate-300 hover:text-white bg-transparent p-0"
//         >
//           ×
//         </button>

//         <TitleCard />
//         <ErrorBanner error={error} />
//         <EmbeddedWalletBadge address={authenticated ? existingAddress : undefined} />

//         {showCustomCreateUI ? (
//           <CreateWalletPanel
//             variant={loginMethod === 'email' ? 'email' : 'oauth'}
//             creating={creating}
//             onCreate={handleCreateEmbeddedWallet}
//           />
//         ) : (
//           <div className="grid gap-4">
//             {!authenticated && (
//               <>
//                 {!walletMode ? (
//                   <>
//                     {emailStep === 'enter-email' ? (
//                       <EmailForm
//                         email={email}
//                         setEmail={setEmail}
//                         emailState={emailState}
//                         onEmailSubmit={onEmailSubmit}
//                         setLoginMethod={setLoginMethod}
//                         disabled={false}
//                       />
//                     ) : (
//                       <CodeForm
//                         code={code}
//                         setCode={setCode}
//                         onBack={() => {
//                           setError('')
//                           setCode('')
//                           setEmail('')
//                           setLoginMethod(null)
//                           setEmailStep('enter-email')
//                         }}
//                         onCodeSubmit={onCodeSubmit}
//                         emailState={emailState}
//                       />
//                     )}

//                     <DividerOr />

//                     <button
//                       className="w-full inline-flex items-center justify-center rounded-2xl border border-emerald-400/50 bg-gradient-to-tr from-emerald-400 via-teal-400 to-cyan-500 px-4 py-3 text-lg font-bold text-white shadow-[0_10px_28px_rgba(16,185,129,0.35)] hover:shadow-[0_14px_34px_rgba(16,185,129,0.45)] active:scale-[.99] transition disabled:opacity-60"
//                       onClick={() => {
//                         if (emailStep === 'enter-code') return
//                         setWalletMode(true)
//                       }}
//                       disabled={emailStep === 'enter-code'}
//                     >
//                       <span className="mr-2 inline-flex items-center">
//                         <WalletIcon />
//                       </span>
//                       <span>Connect Wallet</span>
//                     </button>

//                     <GoogleButton
//                       disabled={oauthLoading || emailStep === 'enter-code'}
//                       onClick={() => {
//                         if (emailStep === 'enter-code') return
//                         setLoginMethod('oauth')
//                         initOAuth({ provider: 'google' })
//                       }}
//                     />
//                   </>
//                 ) : (
//                   <WalletPickerScrollable
//                     connectWith={connectWith}
//                     onBack={() => setWalletMode(false)}
//                   />
//                 )}
//               </>
//             )}
//           </div>
//         )}
//       </div>
//     </dialog>
//   )
// }






// functionlity 2 




// import React, { useEffect, useRef, useState } from 'react'
// import {
//   useConnectWallet,
//   useLoginWithEmail,
//   useLoginWithOAuth,
//   usePrivy,
//   useCreateWallet,
// } from '@privy-io/react-auth'

// import zeroGLogo from '../assets/OG.png'
// import kultGameLogo from '../assets/kultLogo.png'
// import MyLogo from '../assets/logo.png'

// /* ============================== Icons ============================== */
// const WalletIcon = ({ size = 18 }: { size?: number }) => (
//   <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
//     <path d="M3.75 7.5h13.5a3 3 0 0 1 3 3v6.75a3 3 0 0 1-3 3H6.75a3 3 0 0 1-3-3V9.75a2.25 2.25 0 0 1 2.25-2.25Z" stroke="currentColor" strokeWidth="1.6"/>
//     <path d="M18.75 12.75h-2.25a1.5 1.5 0 1 0 0 3h2.25a.75.75 0 0 0 .75-.75v-1.5a.75.75 0 0 0-.75-.75Z" fill="currentColor"/>
//     <path d="M17.25 5.25H6a2.25 2.25 0 0 0-2.25 2.25v1.5" stroke="currentColor" strokeWidth="1.6"/>
//   </svg>
// )

// const GoogleIcon = ({ size = 18 }: { size?: number }) => (
//   <svg width={size} height={size} viewBox="0 0 24 24">
//     <path fill="#4285F4" d="M23.6 12.3c0-.8-.1-1.6-.2-2.3H12v4.4h6.5c-.3 1.6-1.3 3-2.7 3.9v3.2h4.4c2.6-2.3 4.1-5.6 4.1-9.2z"/>
//     <path fill="#34A853" d="M12 24c3.6 0 6.6-1.2 8.8-3.2l-4.4-3.2c-1.2.8-2.7 1.3-4.4 1.3-3.4 0-6.2-2.3-7.2-5.3H.2v3.3C2.3 21.3 6.8 24 12 24z"/>
//     <path fill="#FBBC05" d="M4.8 13.6c-.3-1-.3-2 0-3V7.3H.2C-1 9.6-1 12.4.2 14.7l4.6-1.1z"/>
//     <path fill="#EA4335" d="M12 4.7c1.9 0 3.6.7 4.9 1.9l3.7-3.7C18.6 1 15.6 0 12 0 6.8 0 2.3 2.7.2 7.3l4.6 3.3C5.8 7.1 8.6 4.7 12 4.7z"/>
//   </svg>
// )

// /* ============================== Types ============================== */
// type LoginModalProps = {
//   open: boolean
//   onClose: () => void
//   logoSrc?: string
//   leftLogoSrc?: string
//   centerLogoSrc?: string
//   rightLogoSrc?: string
// }

// /* ============================== Small Components ============================== */
// function HeaderLogos({
//   leftLogoSrc,
//   rightLogoSrc,
// }: { leftLogoSrc?: string; rightLogoSrc?: string }) {
//   return (
//     <>
//       {leftLogoSrc && (
//         <img
//           src={leftLogoSrc}
//           alt="Left logo"
//           className="fixed left-3 top-3 z-[60] w-30 m-3 rounded-md border border-[#222] object-contain pointer-events-none"
//         />
//       )}
//       {rightLogoSrc && (
//         <img
//           src={rightLogoSrc}
//           alt="Right logo"
//           className="fixed right-3 top-3 z-[60] w-24 m-3 rounded-md border border-[#222] object-contain pointer-events-none"
//         />
//       )}
//     </>
//   )
// }

// function TitleCard() {
//   return (
//     <div className="relative overflow-hidden rounded-2xl bg-gradient-to-b from-cyan-400/10 to-transparent pt-8 pb-5 text-center mb-3">
//       <div className="pointer-events-none absolute -inset-20 bg-[radial-gradient(900px_220px_at_50%_-20%,rgba(34,193,241,0.25),transparent)]" />
//       <div className="relative z-10">
//         <h2 className="text-3xl md:text-4xl font-extrabold tracking-wider bg-gradient-to-r from-cyan-300 via-sky-400 to-blue-500 bg-clip-text text-transparent drop-shadow-[0_2px_16px_rgba(0,160,255,0.35)]">
//           WELCOME
//         </h2>
//         <div className="mx-auto mt-2 h-1 w-24 rounded-full bg-gradient-to-r from-transparent via-white/40 to-transparent" />
//       </div>
//     </div>
//   )
// }

// function ErrorBanner({ error }: { error?: string }) {
//   if (!error) return null
//   return (
//     <div className="my-2 rounded-lg bg-[#2a0e0e] px-3 py-2 text-sm text-[#ffd8d8]">
//       {error}
//     </div>
//   )
// }

// function EmbeddedWalletBadge({ address }: { address?: string }) {
//   if (!address) return null
//   return (
//     <div className="mb-3 rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-xs text-white/80 break-all">
//       Wallet: <span className="font-mono text-[11px] text-white/95">{address}</span>
//     </div>
//   )
// }

// function DividerOr() {
//   return (
//     <div className="my-1 grid grid-cols-[1fr_auto_1fr] items-center gap-2 text-[#9CB9D0]">
//       <span className="h-px bg-gradient-to-r from-transparent via-white/25 to-transparent" />
//       <span className="text-xs">or</span>
//       <span className="h-px bg-gradient-to-r from-transparent via-white/25 to-transparent" />
//     </div>
//   )
// }

// function EmailForm({
//   email,
//   setEmail,
//   emailState,
//   onEmailSubmit,
//   setLoginMethod,
//   disabled,
// }: {
//   email: string
//   setEmail: (s: string) => void
//   emailState: ReturnType<typeof useLoginWithEmail>['state']
//   onEmailSubmit: React.FormEventHandler<HTMLFormElement>
//   setLoginMethod: (m: 'email' | 'oauth' | null) => void
//   disabled: boolean
// }) {
//   return (
//     <form className="grid gap-3" onSubmit={onEmailSubmit}>
//       <label className="grid gap-2">
//         <span className="text-sm text-white/70">Email address</span>
//         <input
//           type="email"
//           required
//           placeholder="you@example.com"
//           value={email}
//           onChange={(e) => setEmail(e.target.value)}
//           className="rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-base text-white/95 placeholder-white/40 outline-none focus:ring-2 focus:ring-cyan-400/40 focus:border-white/30 transition"
//           disabled={disabled}
//         />
//       </label>
//       <div className="mt-1">
//         <button
//           type="submit"
//           className="inline-flex w-full items-center justify-center rounded-2xl border border-fuchsia-400/50 bg-gradient-to-tr from-fuchsia-500 to-violet-500 px-5 py-3 font-bold text-white shadow-[0_10px_28px_rgba(217,70,239,0.35)] hover:shadow-[0_14px_34px_rgba(217,70,239,0.45)] active:scale-[.98] disabled:opacity-60"
//           disabled={
//             disabled ||
//             emailState.status === 'sending-code' ||
//             emailState.status === 'submitting-code'
//           }
//           onClick={() => setLoginMethod('email')}
//         >
//           {emailState.status === 'sending-code' ? 'Sending…' : 'Send code'}
//         </button>
//       </div>
//     </form>
//   )
// }

// function CodeForm({
//   code,
//   setCode,
//   onBack,
//   onCodeSubmit,
//   emailState,
// }: {
//   code: string
//   setCode: (s: string) => void
//   onBack: () => void
//   onCodeSubmit: React.FormEventHandler<HTMLFormElement>
//   emailState: ReturnType<typeof useLoginWithEmail>['state']
// }) {
//   return (
//     <form className="grid gap-3" onSubmit={onCodeSubmit}>
//       <label className="grid gap-2">
//         <span className="text-sm text-[#9CB9D0]">Enter 6-digit code</span>
//         <input
//           type="text"
//           pattern="[0-9]{6}"
//           inputMode="numeric"
//           placeholder="123456"
//           value={code}
//           onChange={(e) => setCode(e.target.value)}
//           className="rounded-xl border border-white/20 bg-white/5 px-4 py-3 text-base text-[#EAF6FF] outline-none focus:ring-2 focus:ring-cyan-400/50"
//         />
//       </label>
//       <div className="mt-1 flex justify-between gap-2">
//         <button
//           type="button"
//           onClick={onBack}
//           className="rounded-xl border border-transparent px-3 py-2.5 text-[#9CB9D0] hover:text-white"
//         >
//           Edit email
//         </button>
//         <button
//           type="submit"
//           className="inline-flex items-center justify-center rounded-2xl border border-fuchsia-400/50 bg-gradient-to-tr from-fuchsia-500 to-violet-500 px-5 py-3 font-bold text-white shadow-[0_10px_28px_rgba(217,70,239,0.35)] hover:shadow-[0_14px_34px_rgba(217,70,239,0.45)] active:scale-[.98] disabled:opacity-60"
//           disabled={emailState.status === 'submitting-code' || emailState.status === 'sending-code'}
//         >
//           {emailState.status === 'submitting-code' ? 'Verifying…' : 'Verify & continue'}
//         </button>
//       </div>
//     </form>
//   )
// }

// type WalletId =
//   | 'metamask'
//   | 'coinbase_wallet'
//   | 'bitget_wallet'
//   | 'okx_wallet'
//   | 'wallet_connect_qr'

// function WalletButton({
//   label,
//   onClick,
//   disabled,
// }: { label: string; onClick?: () => void; disabled?: boolean }) {
//   return (
//     <button
//       type="button"
//       disabled={disabled}
//       onClick={onClick}
//       className="inline-flex items-center justify-center rounded-2xl border border-white/15 bg-white/5 px-4 py-3 font-semibold text-white/95 hover:bg-white/10 disabled:opacity-50"
//     >
//       <span className="mr-2"><WalletIcon /></span> {label}
//     </button>
//   )
// }

// function WalletPicker({
//   connectWith,
//   disabled,
// }: {
//   connectWith: (w: WalletId) => Promise<void> | void
//   disabled: boolean
// }) {
//   return (
//     <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
//       <WalletButton label="MetaMask" disabled={disabled} onClick={() => connectWith('metamask')} />
//       <WalletButton label="Coinbase Wallet" disabled={disabled} onClick={() => connectWith('coinbase_wallet')} />
//       <WalletButton label="Bitget" disabled={disabled} onClick={() => connectWith('bitget_wallet')} />
//       <WalletButton label="OKX" disabled={disabled} onClick={() => connectWith('okx_wallet')} />
//       <div className="sm:col-span-2">
//         <WalletButton label="WalletConnect (QR)" disabled={disabled} onClick={() => connectWith('wallet_connect_qr')} />
//       </div>
//     </div>
//   )
// }

// function GoogleButton({
//   onClick,
//   disabled,
// }: {
//   onClick: () => void
//   disabled?: boolean
// }) {
//   return (
//     <button
//       className="flex w-full items-center justify-center rounded-2xl border border-white/15 bg-white/5 px-4 py-3 font-semibold text-white/95 hover:bg-white/10 disabled:opacity-50"
//       disabled={disabled}
//       onClick={onClick}
//       aria-label="Continue with Google"
//     >
//       <GoogleIcon />
//       <span className="ml-2">Google</span>
//     </button>
//   )
// }

// function CreateWalletPanel({
//   variant,
//   creating,
//   onCreate,
// }: {
//   variant: 'email' | 'oauth'
//   creating: boolean
//   onCreate: () => void
// }) {
//   const copy = variant === 'email' ? 'Continue with your email session.' : 'Continue with your Google session.'
//   const color =
//     variant === 'email'
//       ? 'border-fuchsia-400/50 bg-gradient-to-tr from-fuchsia-500 to-violet-500'
//       : 'border-emerald-400/50 bg-gradient-to-tr from-emerald-400 via-teal-400 to-cyan-500'

//   return (
//     <div className="grid gap-4">
//       <div className="rounded-xl bg-amber-500/10 border border-amber-400/30 px-4 py-3 text-sm text-amber-50/90">
//         You don’t have a wallet address yet. We’ll create one now to continue.
//       </div>
//       <div className="rounded-xl border border-white/10 bg-white/5 p-4">
//         <div className="text-sm text-white/80 mb-3">{copy}</div>
//         <button
//           onClick={onCreate}
//           disabled={creating}
//           className={`inline-flex w-full items-center justify-center rounded-2xl ${color} px-5 py-3 font-bold text-white shadow-[0_10px_28px_rgba(16,185,129,0.25)] active:scale-[.98] disabled:opacity-60`}
//         >
//           {creating ? 'Creating wallet…' : 'Create wallet'}
//         </button>
//       </div>

//       {/* Disabled options to match requested flow */}
//       <div className="grid gap-2 opacity-60">
//         <WalletPicker connectWith={() => {}} disabled />
//         <GoogleButton onClick={() => {}} disabled />
//       </div>
//     </div>
//   )
// }

// /* ============================== MAIN COMPONENT ============================== */
// export default function LoginModal({
//   open,
//   onClose,
//   logoSrc,
//   leftLogoSrc = kultGameLogo,
//   centerLogoSrc = MyLogo,
//   rightLogoSrc = zeroGLogo,
// }: LoginModalProps) {
//   const dialogRef = useRef<HTMLDialogElement | null>(null)
//   const [email, setEmail] = useState('')
//   const [code, setCode] = useState('')
//   const [emailStep, setEmailStep] = useState<'enter-email' | 'enter-code'>('enter-email')
//   const [error, setError] = useState('')
//   const [loginMethod, setLoginMethod] = useState<'email' | 'oauth' | null>(null)
//   const [needsWallet, setNeedsWallet] = useState(false)
//   const [creating, setCreating] = useState(false)

//   const { ready, authenticated, user } = usePrivy()
//   const { createWallet } = useCreateWallet()

//   const existingAddress =
//     (user as any)?.wallet?.address ??
//     (user as any)?.embeddedWallets?.[0]?.address ??
//     (user as any)?.wallets?.[0]?.address
//   const hasAnyWallet = Boolean(existingAddress)

//   const { connectWallet } = useConnectWallet({
//     onSuccess: () => onClose?.(),
//     onError: (err: any) => setError((err?.message ?? err?.code ?? String(err)) || 'Failed to connect wallet'),
//   })

//   const { initOAuth, loading: oauthLoading } = useLoginWithOAuth({
//     onComplete: async () => {
//       if (!hasAnyWallet) {
//         setLoginMethod('oauth')
//         setNeedsWallet(true)
//         return
//       }
//       onClose?.()
//     },
//     onError: (err: any) => setError((err?.message ?? err?.code ?? String(err)) || 'OAuth error'),
//   })

//   const { sendCode, loginWithCode, state: emailState } = useLoginWithEmail({
//     onComplete: async () => {
//       if (!hasAnyWallet) {
//         setLoginMethod('email')
//         setNeedsWallet(true)
//         return
//       }
//       onClose?.()
//     },
//     onError: (err: any) => setError((err?.message ?? err?.code ?? String(err)) || 'Email login error'),
//   })

//   // Create wallet with our own UI
//   const handleCreateEmbeddedWallet = async () => {
//     setError('')
//     setCreating(true)
//     try {
//       await createWallet()
//       setNeedsWallet(false)
//       onClose?.()
//     } catch (err: any) {
//       setError(err?.message || 'Failed to create wallet')
//     } finally {
//       setCreating(false)
//     }
//   }

//   // Custom wallet picker connects
//   const connectWith = async (wallet: WalletId) => {
//     if (emailStep === 'enter-code' || (needsWallet && authenticated && !hasAnyWallet)) return
//     try {
//       if (dialogRef.current?.open) dialogRef.current.close()
//     } catch {}
//     onClose?.()
//     await connectWallet({ walletList: [wallet], walletChainType: 'ethereum-only' })
//   }

//   // Effects
//   useEffect(() => {
//     setError('')
//     setEmail('')
//     setCode('')
//     setEmailStep('enter-email')
//     setLoginMethod(null)
//     setNeedsWallet(false)
//   }, [open])

//   useEffect(() => {
//     if (open && dialogRef.current && !dialogRef.current.open) dialogRef.current.showModal()
//     if (!open && dialogRef.current?.open) dialogRef.current.close()
//     return () => {
//       try { if (dialogRef.current?.open) dialogRef.current.close() } catch {}
//     }
//   }, [open])

//   useEffect(() => {
//     if (ready && authenticated) {
//       if (!hasAnyWallet && loginMethod) setNeedsWallet(true)
//       if (hasAnyWallet) setNeedsWallet(false)
//     }
//   }, [ready, authenticated, hasAnyWallet, loginMethod])

//   // Handlers for forms
//   const onEmailSubmit: React.FormEventHandler<HTMLFormElement> = async (e) => {
//     e.preventDefault()
//     setError('')
//     try {
//       setLoginMethod('email')
//       await sendCode({ email })
//       setEmailStep('enter-code')
//     } catch (err: any) {
//       setError(err?.message || 'Failed to send code')
//     }
//   }

//   const onCodeSubmit: React.FormEventHandler<HTMLFormElement> = async (e) => {
//     e.preventDefault()
//     setError('')
//     try {
//       await loginWithCode({ code })
//     } catch (err: any) {
//       setError(err?.message || 'Invalid code')
//     }
//   }

//   // UI gating rules
//   const showCustomCreateUI = needsWallet && authenticated && !hasAnyWallet
//   const authOptionsDisabled = emailStep === 'enter-code' || showCustomCreateUI

//   return (
//     <dialog
//       ref={dialogRef}
//       onCancel={onClose}
//       className="fixed inset-0 z-50 m-auto w-[92vw] max-w-[500px] max-h-[92dvh] overflow-visible rounded-2xl border border-white/10 bg-[rgba(10,16,34,0.70)] shadow-[0_30px_80px_rgba(0,0,0,0.55)] p-0"
//     >
//       <HeaderLogos leftLogoSrc={leftLogoSrc} rightLogoSrc={rightLogoSrc} />

//       <div className="relative p-6 pt-10 md:pt-10 text-[#EAF6FF] bg-gradient-to-b from-[rgba(10,16,34,0.75)] to-[rgba(8,16,34,0.45)]">
//         {(centerLogoSrc ?? logoSrc) && (
//           <img
//             src={centerLogoSrc ?? logoSrc}
//             alt="Center logo"
//             className="absolute left-1/2 -top-8 md:-top-10 -translate-x-1/2 z-20 w-26 md:w-34 rounded-xl border border-[#222] object-contain"
//           />
//         )}

//         <button
//           type="button"
//           onClick={onClose}
//           aria-label="Close"
//           className="absolute right-3 top-2 text-2xl leading-none text-slate-300 hover:text-white bg-transparent p-0"
//         >
//           ×
//         </button>

//         <TitleCard />
//         <ErrorBanner error={error} />
//         <EmbeddedWalletBadge address={authenticated ? existingAddress : undefined} />

//         {showCustomCreateUI ? (
//           <CreateWalletPanel
//             variant={loginMethod === 'email' ? 'email' : 'oauth'}
//             creating={creating}
//             onCreate={handleCreateEmbeddedWallet}
//           />
//         ) : (
//           <div className="grid gap-4">
//             {!authenticated && (
//               <>
//                 {emailStep === 'enter-email' ? (
//                   <EmailForm
//                     email={email}
//                     setEmail={setEmail}
//                     emailState={emailState}
//                     onEmailSubmit={onEmailSubmit}
//                     setLoginMethod={setLoginMethod}
//                     disabled={false}
//                   />
//                 ) : (
//                   <CodeForm
//                     code={code}
//                     setCode={setCode}
//                     onBack={() => {
//                       setError('')
//                       setCode('')
//                       setEmail('')
//                       setLoginMethod(null)
//                       setEmailStep('enter-email') // re-enable other options
//                     }}
//                     onCodeSubmit={onCodeSubmit}
//                     emailState={emailState}
//                   />
//                 )}

//                 <DividerOr />

//                 {/* Custom wallet list (always visible, but disabled while entering OTP or in create-wallet step) */}
//                 <WalletPicker connectWith={connectWith} disabled={authOptionsDisabled} />

//                 {/* Social button (disabled when appropriate) */}
//                 <GoogleButton
//                   disabled={oauthLoading || authOptionsDisabled}
//                   onClick={() => {
//                     if (authOptionsDisabled) return
//                     setLoginMethod('oauth')
//                     initOAuth({ provider: 'google' })
//                   }}
//                 />
//               </>
//             )}
//           </div>
//         )}
//       </div>
//     </dialog>
//   )
// }
