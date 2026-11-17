// src/lib/ai-storage.ts — browser storage for AI settings. Safe to import anywhere:
// every function checks for `window` and returns defaults during SSR.
//
// - Provider + model choice → localStorage (kept after the browser closes; not secret).
// - API keys → sessionStorage, one per provider (cleared when the browser closes).
import {
  AI_PROVIDER_IDS,
  AI_PROVIDERS,
  DEFAULT_AI_PROVIDER,
  isAiProviderId,
  type AiProviderId,
} from './ai/providers'

const SELECTION_KEY = 'quizly.ai.selection'
const API_KEY_PREFIX = 'quizly.ai.apiKey.'
/** Key name used before multi-provider support (Gemini only). */
const LEGACY_GEMINI_KEY = 'geminiApiKey'

/** Current provider, plus the last model picked for each provider. */
export type AiSelection = {
  provider: AiProviderId
  models: Record<AiProviderId, string>
}

export function defaultAiSelection(): AiSelection {
  const models = {} as Record<AiProviderId, string>
  for (const id of AI_PROVIDER_IDS) models[id] = AI_PROVIDERS[id].defaultModel
  return { provider: DEFAULT_AI_PROVIDER, models }
}

function getStorage(kind: 'local' | 'session'): Storage | null {
  if (typeof window === 'undefined') return null
  try {
    return kind === 'local' ? window.localStorage : window.sessionStorage
  } catch {
    // Storage can be blocked (private mode, site data disabled).
    return null
  }
}

function safeGet(storage: Storage | null, key: string): string | null {
  try {
    return storage?.getItem(key) ?? null
  } catch {
    return null
  }
}

function safeSet(storage: Storage | null, key: string, value: string): void {
  try {
    storage?.setItem(key, value)
  } catch {
    /* ignore: setting just won't persist */
  }
}

function safeRemove(storage: Storage | null, key: string): void {
  try {
    storage?.removeItem(key)
  } catch {
    /* ignore */
  }
}

// --- Provider + model (localStorage) ---

export function loadAiSelection(): AiSelection {
  const fallback = defaultAiSelection()
  const raw = safeGet(getStorage('local'), SELECTION_KEY)
  if (!raw) return fallback
  try {
    const parsed = JSON.parse(raw) as Partial<AiSelection>
    const provider = isAiProviderId(parsed.provider)
      ? parsed.provider
      : fallback.provider
    const models = { ...fallback.models }
    if (parsed.models && typeof parsed.models === 'object') {
      for (const id of AI_PROVIDER_IDS) {
        const m = (parsed.models as Record<string, unknown>)[id]
        if (typeof m === 'string' && m.trim()) models[id] = m.trim()
      }
    }
    return { provider, models }
  } catch {
    return fallback
  }
}

export function saveAiSelection(selection: AiSelection): void {
  safeSet(getStorage('local'), SELECTION_KEY, JSON.stringify(selection))
}

// --- API keys (sessionStorage) ---

export function getApiKey(provider: AiProviderId): string | null {
  const key = safeGet(getStorage('session'), API_KEY_PREFIX + provider)
  return key?.trim() || null
}

export function setApiKey(provider: AiProviderId, key: string): void {
  safeSet(getStorage('session'), API_KEY_PREFIX + provider, key.trim())
}

export function clearApiKey(provider: AiProviderId): void {
  safeRemove(getStorage('session'), API_KEY_PREFIX + provider)
}

/** Move a Gemini key saved by the old version to the new per-provider slot. */
export function migrateLegacyGeminiKey(): void {
  const session = getStorage('session')
  const legacy = safeGet(session, LEGACY_GEMINI_KEY)?.trim()
  if (!legacy) return
  if (!getApiKey('google')) setApiKey('google', legacy)
  safeRemove(session, LEGACY_GEMINI_KEY)
}

export function maskApiKey(key: string): string {
  const trimmed = key.trim()
  if (trimmed.length <= 8) return '••••••••'
  return `${trimmed.slice(0, 4)}…${trimmed.slice(-4)}`
}
