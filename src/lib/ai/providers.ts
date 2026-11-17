// src/lib/ai/providers.ts — provider/model catalog shared by server and client.
// No API keys here: this file is imported by the browser (Settings, model switcher).

export const AI_PROVIDER_IDS = ['google', 'anthropic', 'openai', 'deepseek'] as const

export type AiProviderId = (typeof AI_PROVIDER_IDS)[number]

export type AiModelOption = { id: string; label: string }

export type AiProviderInfo = {
  id: AiProviderId
  /** Display name, e.g. "Gemini". */
  label: string
  /** Server env var used as a fallback key (local dev). */
  envVar: string
  /** Where users get an API key. */
  keyUrl: string
  /** Preset models shown in dropdowns. Users can also type a custom model id. */
  models: AiModelOption[]
  defaultModel: string
}

// Model ids taken from the model definitions shipped in @ai-sdk/* (Nov 2026).
// Gemini uses the "-latest" aliases so the preset does not go stale.
export const AI_PROVIDERS: Record<AiProviderId, AiProviderInfo> = {
  google: {
    id: 'google',
    label: 'Gemini',
    envVar: 'GEMINI_API_KEY',
    keyUrl: 'https://aistudio.google.com/apikey',
    models: [
      { id: 'gemini-flash-latest', label: 'Gemini Flash (latest)' },
      { id: 'gemini-flash-lite-latest', label: 'Gemini Flash-Lite (latest)' },
      { id: 'gemini-pro-latest', label: 'Gemini Pro (latest)' },
    ],
    defaultModel: 'gemini-flash-latest',
  },
  anthropic: {
    id: 'anthropic',
    label: 'Claude',
    envVar: 'ANTHROPIC_API_KEY',
    keyUrl: 'https://console.anthropic.com/settings/keys',
    models: [
      { id: 'claude-sonnet-5-5', label: 'Claude Sonnet 5.5' },
      { id: 'claude-haiku-5-5', label: 'Claude Haiku 5.5' },
      { id: 'claude-opus-5-5', label: 'Claude Opus 5.5' },
    ],
    defaultModel: 'claude-sonnet-5-5',
  },
  openai: {
    id: 'openai',
    label: 'OpenAI',
    envVar: 'OPENAI_API_KEY',
    keyUrl: 'https://platform.openai.com/api-keys',
    models: [
      { id: 'gpt-5.5', label: 'GPT-5.5' },
      { id: 'gpt-5.4-mini', label: 'GPT-5.4 mini' },
    ],
    defaultModel: 'gpt-5.5',
  },
  deepseek: {
    id: 'deepseek',
    label: 'DeepSeek',
    envVar: 'DEEPSEEK_API_KEY',
    keyUrl: 'https://platform.deepseek.com/api_keys',
    models: [
      { id: 'deepseek-flash', label: 'DeepSeek Flash (latest)' },
      { id: 'deepseek-v4-pro', label: 'DeepSeek V4 Pro' },
    ],
    defaultModel: 'deepseek-flash',
  },
}

export const DEFAULT_AI_PROVIDER: AiProviderId = 'google'

export function isAiProviderId(value: unknown): value is AiProviderId {
  return (
    typeof value === 'string' &&
    (AI_PROVIDER_IDS as readonly string[]).includes(value)
  )
}

/** What the client sends with each AI request. */
export type AiRequestConfig = {
  provider: AiProviderId
  model: string
  /** BYOK key from the browser; optional when the server has an env key. */
  apiKey?: string
}

/** Stored in messages.model_used, e.g. "anthropic/claude-sonnet-5-5". */
export function formatModelUsed(provider: AiProviderId, model: string): string {
  return `${provider}/${model}`
}
