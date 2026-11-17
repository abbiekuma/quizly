// src/lib/ai/keys.server.ts — decide which provider/model/key a request uses. Server only.
import {
  AI_PROVIDERS,
  DEFAULT_AI_PROVIDER,
  isAiProviderId,
  type AiProviderId,
  type AiRequestConfig,
} from './providers'
import { AiUserError } from './errors.server'

/** Provider + model + a key that is guaranteed to be present. */
export type ResolvedAiConfig = {
  provider: AiProviderId
  model: string
  apiKey: string
}

/** Prefer the request (BYOK) key; fall back to the provider's env var for local dev. */
export function resolveApiKey(
  provider: AiProviderId,
  requestApiKey?: string,
): string {
  const fromRequest = requestApiKey?.trim()
  if (fromRequest) return fromRequest

  const info = AI_PROVIDERS[provider]
  const fromEnv = process.env[info.envVar]?.trim()
  if (fromEnv) return fromEnv

  throw new AiUserError(
    `${info.label} API key required. Add yours in Settings (or set ${info.envVar} for local dev).`,
  )
}

/**
 * Validate the client's AI config and attach a usable key.
 * `legacyApiKey` supports the old request shape (Gemini key only) until the client sends `ai`.
 */
export function resolveAiConfig(
  ai: AiRequestConfig | undefined,
  legacyApiKey?: string,
): ResolvedAiConfig {
  if (!ai) {
    const provider = DEFAULT_AI_PROVIDER
    return {
      provider,
      model: AI_PROVIDERS[provider].defaultModel,
      apiKey: resolveApiKey(provider, legacyApiKey),
    }
  }

  if (!isAiProviderId(ai.provider)) {
    throw new AiUserError(`Unknown AI provider: ${String(ai.provider)}`)
  }
  const model = typeof ai.model === 'string' ? ai.model.trim() : ''
  if (!model) {
    throw new AiUserError('Please choose a model in Settings.')
  }
  return {
    provider: ai.provider,
    model,
    apiKey: resolveApiKey(ai.provider, ai.apiKey),
  }
}
