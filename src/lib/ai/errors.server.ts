// src/lib/ai/errors.server.ts — turn provider errors into messages a user can act on. Server only.
import { APICallError } from 'ai'
import { AI_PROVIDERS, type AiProviderId } from './providers'

/** An error whose message is safe and meant to be shown to the user as-is. */
export class AiUserError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AiUserError'
  }
}

/** Retries wrap the real API error (e.g. after repeated 429s); unwrap it. */
function unwrapApiCallError(err: unknown): APICallError | undefined {
  if (APICallError.isInstance(err)) return err
  const last = (err as { lastError?: unknown } | null)?.lastError
  if (APICallError.isInstance(last)) return last
  return undefined
}

export function toFriendlyAiError(
  err: unknown,
  provider: AiProviderId,
  model: string,
): Error {
  if (err instanceof AiUserError) return err

  const label = AI_PROVIDERS[provider].label
  const apiError = unwrapApiCallError(err)
  const status = apiError?.statusCode

  if (status === 401 || status === 403) {
    return new AiUserError(
      `Your ${label} API key was rejected. Check it in Settings.`,
    )
  }
  if (status === 429) {
    return new AiUserError(
      `${label} rate limit or quota reached. Wait a moment, or check your plan/billing.`,
    )
  }
  if (status === 404) {
    return new AiUserError(
      `${label} model "${model}" was not found. Pick another model in Settings.`,
    )
  }

  const detail = err instanceof Error ? err.message : String(err)
  return new AiUserError(`${label} request failed: ${detail}`)
}
