// src/contexts/AiSettingsContext.tsx — current AI provider/model and per-provider API keys.
//
// SSR note: the server cannot see localStorage/sessionStorage, so the first render
// (server and client) uses defaults. After mount we read storage and set `ready`.
// UI that depends on keys (e.g. "add your key" notices) should wait for `ready`
// so it does not flash the wrong message.
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { useServerFn } from '@tanstack/react-start'
import { getAiKeyStatus } from '../lib/chat.functions'
import { getOwnerStatus } from '../lib/owner.functions'
import type { OwnerStatus } from '../lib/owner.server'
import {
  AI_PROVIDER_IDS,
  AI_PROVIDERS,
  type AiProviderId,
  type AiRequestConfig,
} from '../lib/ai/providers'
import {
  clearApiKey,
  defaultAiSelection,
  getApiKey,
  loadAiSelection,
  maskApiKey,
  migrateLegacyGeminiKey,
  saveAiSelection,
  setApiKey,
  type AiSelection,
} from '../lib/ai-storage'

export type ProviderKeyStatus = {
  /** Masked browser (BYOK) key, or null if none saved. */
  maskedKey: string | null
  /** Server env var is set for this provider. */
  hasServerKey: boolean
  /** Either kind of key is available. */
  isReady: boolean
}

type AiSettingsContextValue = {
  /** Storage and server key status have been loaded. */
  ready: boolean
  provider: AiProviderId
  model: string
  /** Last model chosen for each provider. */
  models: Record<AiProviderId, string>
  keyStatus: Record<AiProviderId, ProviderKeyStatus>
  /** Current provider has a key. */
  isConfigured: boolean
  setProvider: (provider: AiProviderId) => void
  setModel: (provider: AiProviderId, model: string) => void
  /** Switch provider and model together (quick switch). */
  selectModel: (provider: AiProviderId, model: string) => void
  saveKey: (provider: AiProviderId, key: string) => void
  removeKey: (provider: AiProviderId) => void
  /** What to send with each AI request. */
  getRequestConfig: () => AiRequestConfig
  /** Owner mode status from the server (null until loaded). */
  ownerStatus: OwnerStatus | null
  /** Re-fetch server key status and owner status (after unlock / log out). */
  refreshServerStatus: () => Promise<void>
}

const AiSettingsContext = createContext<AiSettingsContextValue | null>(null)

function emptyRecord<T>(value: T): Record<AiProviderId, T> {
  const r = {} as Record<AiProviderId, T>
  for (const id of AI_PROVIDER_IDS) r[id] = value
  return r
}

function readMaskedKeys(): Record<AiProviderId, string | null> {
  const r = emptyRecord<string | null>(null)
  for (const id of AI_PROVIDER_IDS) {
    const key = getApiKey(id)
    r[id] = key ? maskApiKey(key) : null
  }
  return r
}

export function AiSettingsProvider({ children }: { children: ReactNode }) {
  const getAiKeyStatusFn = useServerFn(getAiKeyStatus)
  const getOwnerStatusFn = useServerFn(getOwnerStatus)
  const [ownerStatus, setOwnerStatus] = useState<OwnerStatus | null>(null)
  const [selection, setSelection] = useState<AiSelection>(defaultAiSelection)
  const [maskedKeys, setMaskedKeys] = useState(() => emptyRecord<string | null>(null))
  const [serverKeys, setServerKeys] = useState(() => emptyRecord(false))
  const [storageLoaded, setStorageLoaded] = useState(false)
  const [serverStatusLoaded, setServerStatusLoaded] = useState(false)

  // Read browser storage once, after mount (not during SSR).
  useEffect(() => {
    migrateLegacyGeminiKey()
    setSelection(loadAiSelection())
    setMaskedKeys(readMaskedKeys())
    setStorageLoaded(true)
  }, [])

  const refreshServerStatus = useCallback(async () => {
    const [keys, owner] = await Promise.allSettled([
      getAiKeyStatusFn(),
      getOwnerStatusFn(),
    ])
    setServerKeys(
      keys.status === 'fulfilled' ? keys.value.serverKeys : emptyRecord(false),
    )
    setOwnerStatus(owner.status === 'fulfilled' ? owner.value : null)
    setServerStatusLoaded(true)
  }, [getAiKeyStatusFn, getOwnerStatusFn])

  useEffect(() => {
    void refreshServerStatus()
  }, [refreshServerStatus])

  const updateSelection = useCallback((next: (prev: AiSelection) => AiSelection) => {
    setSelection((prev) => {
      const value = next(prev)
      saveAiSelection(value)
      return value
    })
  }, [])

  const setProvider = useCallback(
    (provider: AiProviderId) => updateSelection((prev) => ({ ...prev, provider })),
    [updateSelection],
  )

  const setModel = useCallback(
    (provider: AiProviderId, model: string) => {
      const trimmed = model.trim()
      if (!trimmed) return
      updateSelection((prev) => ({
        ...prev,
        models: { ...prev.models, [provider]: trimmed },
      }))
    },
    [updateSelection],
  )

  const selectModel = useCallback(
    (provider: AiProviderId, model: string) => {
      const trimmed = model.trim()
      if (!trimmed) return
      updateSelection((prev) => ({
        provider,
        models: { ...prev.models, [provider]: trimmed },
      }))
    },
    [updateSelection],
  )

  const saveKey = useCallback((provider: AiProviderId, key: string) => {
    const trimmed = key.trim()
    if (!trimmed) return
    setApiKey(provider, trimmed)
    setMaskedKeys((prev) => ({ ...prev, [provider]: maskApiKey(trimmed) }))
  }, [])

  const removeKey = useCallback((provider: AiProviderId) => {
    clearApiKey(provider)
    setMaskedKeys((prev) => ({ ...prev, [provider]: null }))
  }, [])

  const keyStatus = useMemo(() => {
    const r = {} as Record<AiProviderId, ProviderKeyStatus>
    for (const id of AI_PROVIDER_IDS) {
      const maskedKey = maskedKeys[id]
      const hasServerKey = serverKeys[id]
      r[id] = { maskedKey, hasServerKey, isReady: Boolean(maskedKey) || hasServerKey }
    }
    return r
  }, [maskedKeys, serverKeys])

  const provider = selection.provider
  const model = selection.models[provider] || AI_PROVIDERS[provider].defaultModel

  const getRequestConfig = useCallback((): AiRequestConfig => {
    // Read the key at send time so it is never kept in React state.
    const apiKey = getApiKey(provider) ?? undefined
    return { provider, model, apiKey }
  }, [provider, model])

  const value = useMemo<AiSettingsContextValue>(
    () => ({
      ready: storageLoaded && serverStatusLoaded,
      provider,
      model,
      models: selection.models,
      keyStatus,
      isConfigured: keyStatus[provider].isReady,
      setProvider,
      setModel,
      selectModel,
      saveKey,
      removeKey,
      getRequestConfig,
      ownerStatus,
      refreshServerStatus,
    }),
    [
      storageLoaded,
      serverStatusLoaded,
      provider,
      model,
      selection.models,
      keyStatus,
      setProvider,
      setModel,
      selectModel,
      saveKey,
      removeKey,
      getRequestConfig,
      ownerStatus,
      refreshServerStatus,
    ],
  )

  return (
    <AiSettingsContext.Provider value={value}>{children}</AiSettingsContext.Provider>
  )
}

export function useAiSettings() {
  const ctx = useContext(AiSettingsContext)
  if (!ctx) {
    throw new Error('useAiSettings must be used within AiSettingsProvider')
  }
  return ctx
}
