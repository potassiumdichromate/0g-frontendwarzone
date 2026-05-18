import { useEffect, useRef, useState } from 'react'
import { getAllowedChainFromEnv, type AllowedChainConfig } from '../lib/chain'
import { getStableInjectedProvider } from '../lib/injectedEthereum'

type Props = {
  open: boolean
  onClose: () => void
  onSwitched?: () => void
}

declare global {
  interface Window { ethereum?: any }
}

export default function NetworkModal({ open, onClose, onSwitched }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string>('')

  const allowed: AllowedChainConfig =
    getAllowedChainFromEnv() || {
      caip2: 'eip155:16661',
      decimalChainId: 16661,
      hexChainId: '0x4115',
      chainName: '0G Mainnet',
      nativeCurrency: { name: '0G', symbol: '0G', decimals: 18 },
      rpcUrls: ['https://evmrpc.0g.ai'],
      blockExplorerUrls: ['https://chainscan.0g.ai'],
    }

  useEffect(() => {
    if (open && dialogRef.current && !dialogRef.current.open) dialogRef.current.showModal()
    if (!open && dialogRef.current?.open) dialogRef.current.close()
    return () => { try { if (dialogRef.current?.open) dialogRef.current.close() } catch {} }
  }, [open])

  const trySwitch = async () => {
    setError('')
    setLoading(true)
    const eth = getStableInjectedProvider()
    try {
      if (!eth?.request) {
        setError('No EIP-1193 wallet detected. Please switch networks in your wallet to continue.')
        return
      }

      // Try direct switch
      await eth.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: allowed.hexChainId }] })
      // Success
      onSwitched?.()
      onClose()
      return
    } catch (err: any) {
      // If chain is unrecognized (MetaMask 4902), try to add if RPC is provided
      const msg = err?.message || String(err)
      // 4902 = Unrecognized chain; different wallets use different codes, fall back to generic add attempt if RPC available
      const hasRpc = Array.isArray(allowed.rpcUrls) && allowed.rpcUrls.length > 0
      if (hasRpc && eth?.request) {
        try {
          await eth.request({
            method: 'wallet_addEthereumChain',
            params: [
              {
                chainId: allowed.hexChainId,
                chainName: allowed.chainName || `Chain ${allowed.decimalChainId}`,
                nativeCurrency: allowed.nativeCurrency || { name: 'Token', symbol: 'TKN', decimals: 18 },
                rpcUrls: allowed.rpcUrls,
                blockExplorerUrls: allowed.blockExplorerUrls || [],
              },
            ],
          })
          await eth.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: allowed.hexChainId }] })
          onSwitched?.()
          onClose()
          return
        } catch (addErr: any) {
          setError(addErr?.message || 'Failed to add/switch network in wallet')
          return
        }
      }
      setError(msg || 'Failed to switch network')
    } finally {
      setLoading(false)
    }
  }

  return (
    <dialog
      ref={dialogRef}
      onCancel={onClose}
      className="fixed inset-0 z-[70] m-auto w-[92vw] max-w-[480px] max-h-[92dvh] overflow-visible rounded-2xl border border-white/10 bg-[rgba(10,16,34,0.78)] shadow-[0_30px_80px_rgba(0,0,0,0.55)] p-0"
    >
      <div className="relative p-6 text-[#EAF6FF]">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-3 top-2 text-2xl leading-none text-slate-300 hover:text-white bg-transparent p-0"
        >
          ×
        </button>

        <h3 className="text-xl font-bold mb-2">Switch Network Required</h3>
        <p className="text-sm text-white/80 mb-3">
          This app only supports{' '}
          {allowed.chainName || `chain ID ${allowed.decimalChainId}`} (chain ID {allowed.decimalChainId}).
          Please switch your wallet to continue.
        </p>
        {allowed.blockExplorerUrls?.[0] && (
          <div className="mb-3 text-xs text-white/70">
            Explorer: <a href={allowed.blockExplorerUrls[0]} target="_blank" rel="noreferrer" className="underline">
              {allowed.blockExplorerUrls[0]}
            </a>
          </div>
        )}
        {allowed.rpcUrls?.[0] && (
          <div className="mb-3 text-xs text-white/70">
            RPC: <span className="opacity-90">{allowed.rpcUrls[0]}</span>
          </div>
        )}
        {error && (
          <div className="mb-3 rounded-md bg-[#2a0e0e] border border-[#4a1b1b] px-3 py-2 text-xs text-[#ffd8d8]">
            {error}
          </div>
        )}
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-white/90 hover:bg-white/10"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={trySwitch}
            disabled={loading}
            className="rounded-lg border border-cyan-400/50 bg-gradient-to-tr from-emerald-400 via-teal-400 to-cyan-500 px-3 py-2 text-sm font-semibold text-white shadow-[0_8px_20px_rgba(16,185,129,0.30)] disabled:opacity-60"
          >
            {loading ? 'Switching…' : 'Switch network'}
          </button>
        </div>
      </div>
    </dialog>
  )
}
