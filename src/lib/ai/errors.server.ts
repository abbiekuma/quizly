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

/** True if the call was stopped by our timeout (the SDK aborts with a "TimeoutError"). */
function isTimeoutError(err: unknown): boolean {
  const candidates = [
    err,
    (err as { lastError?: unknown } | null)?.lastError,
    (err as { cause?: unknown } | null)?.cause,
  ]
  return candidates.some((e) => {
    const name = (e as { name?: unknown } | null)?.name
    return name === 'TimeoutError' || name === 'AbortError'
  })
}

export function toFriendlyAiError(
  err: unknown,
  provider: AiProviderId,
  model: string,
): Error {
  if (err instanceof AiUserError) return err

  const label = AI_PROVIDERS[provider].label

  if (isTimeoutError(err)) {
    return new AiUserError(
      `${label} took too long to respond. Try again, or switch to a faster model.`,
    )
  }

  // Structured output could not be parsed (wrong format, or cut off by maxOutputTokens).
  // The SDK does not export this class, so match by name.
  if ((err as { name?: unknown } | null)?.name === 'AI_NoObjectGeneratedError') {
    return new AiUserError(
      `${label} returned the quiz in an unexpected format. Please try again, or switch model.`,
    )
  }

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

  // 503 = overloaded (Gemini "high demand"), 529 = Anthropic "overloaded", 500/502/504 = provider-side trouble.
  if (status === 503 || status === 529 || status === 500 || status === 502 || status === 504) {
    return new AiUserError(
      `${label} is busy right now. Try again in a moment, or switch to another model.`,
    )
  }

  const detail = err instanceof Error ? err.message : String(err)
  return new AiUserError(`${label} request failed: ${detail}`)
}
