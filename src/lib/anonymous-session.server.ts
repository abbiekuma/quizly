import { getCookie, setCookie } from '@tanstack/react-start/server'

const COOKIE_NAME = 'anonymous_session_id'

// Guest ids must be UUIDs we generated. The cookie comes from the browser and can be edited,
// so anything else (e.g. a hand-set "owner") is ignored and replaced.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function readValidSessionId(): string | undefined {
  const value = getCookie(COOKIE_NAME)
  return value && UUID_RE.test(value) ? value : undefined
}

/** Browser session cookie: cleared when the browser closes. */
export function getOrCreateSessionId(): string {
  const existing = readValidSessionId()
  if (existing) return existing

  const sessionId = crypto.randomUUID()
  setCookie(COOKIE_NAME, sessionId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
  })
  return sessionId
}

/** Read the current anonymous session id without creating one (used when moving data to the owner). */
export function getExistingSessionId(): string | undefined {
  return readValidSessionId()
}
