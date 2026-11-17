// src/lib/owner.server.ts — owner mode: passcode check, signed owner cookie, data move. Server only.
//
// The owner unlocks with OWNER_PASSCODE (env). The server then sets an httpOnly cookie
// `owner_session` = "<expiresAtMs>.<signature>", where signature = HMAC-SHA256(passcode, "owner:<expiresAtMs>").
// Nobody can forge it without the passcode, and changing the passcode invalidates every cookie.
import { createHash, createHmac, timingSafeEqual } from 'node:crypto'
import { deleteCookie, getCookie, setCookie } from '@tanstack/react-start/server'
import { eq } from 'drizzle-orm'
import { db } from '../db/index'
import { conversations, quizzes } from '../db/schema'
import { getExistingSessionId } from './anonymous-session.server'

/** Fixed session id for the owner's data (conversations.session_id / quizzes.session_id). */
export const OWNER_SESSION_ID = 'owner'

const COOKIE_NAME = 'owner_session'
const DAY_MS = 24 * 60 * 60 * 1000
const COOKIE_LIFETIME_MS = 30 * DAY_MS
/** Renew the cookie at most once a day, not on every request. */
const RENEW_AFTER_MS = DAY_MS

function getPasscode(): string | undefined {
  return process.env.OWNER_PASSCODE?.trim() || undefined
}

/** Owner mode is off when OWNER_PASSCODE is not set. */
export function isOwnerModeEnabled(): boolean {
  return Boolean(getPasscode())
}

/** Constant-time compare. Hash both first so different lengths are fine. */
function safeEqual(a: string, b: string): boolean {
  const ha = createHash('sha256').update(a).digest()
  const hb = createHash('sha256').update(b).digest()
  return timingSafeEqual(ha, hb)
}

function sign(expiresAt: number, passcode: string): string {
  return createHmac('sha256', passcode).update(`owner:${expiresAt}`).digest('base64url')
}

function setOwnerCookie(passcode: string): number {
  const expiresAt = Date.now() + COOKIE_LIFETIME_MS
  setCookie(COOKIE_NAME, `${expiresAt}.${sign(expiresAt, passcode)}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: COOKIE_LIFETIME_MS / 1000,
  })
  return expiresAt
}

/** Expiry time (ms) of a valid owner cookie, or null if missing / forged / expired / mode off. */
function readOwnerCookie(): number | null {
  const passcode = getPasscode()
  if (!passcode) return null
  const raw = getCookie(COOKIE_NAME)
  if (!raw) return null
  const dot = raw.indexOf('.')
  if (dot <= 0) return null
  const expiresAt = Number(raw.slice(0, dot))
  const signature = raw.slice(dot + 1)
  if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) return null
  if (!safeEqual(signature, sign(expiresAt, passcode))) return null
  return expiresAt
}

/**
 * Is this request from the owner? Also renews the cookie (sliding 30 days)
 * when it was issued more than a day ago.
 */
export function isOwnerRequest(): boolean {
  const expiresAt = readOwnerCookie()
  if (expiresAt == null) return false
  const issuedAt = expiresAt - COOKIE_LIFETIME_MS
  if (Date.now() - issuedAt > RENEW_AFTER_MS) {
    const passcode = getPasscode()
    if (passcode) setOwnerCookie(passcode)
  }
  return true
}

export type OwnerStatus = {
  /** OWNER_PASSCODE is set on the server. */
  enabled: boolean
  isOwner: boolean
  /** When the owner cookie expires (ISO string), if owner. */
  expiresAt: string | null
}

export function getOwnerStatusImpl(): OwnerStatus {
  const enabled = isOwnerModeEnabled()
  const expiresAt = enabled ? readOwnerCookie() : null
  return {
    enabled,
    isOwner: expiresAt != null,
    expiresAt: expiresAt != null ? new Date(expiresAt).toISOString() : null,
  }
}

/** Move this browser's guest conversations and quizzes to the owner. Changes only session_id. */
async function moveGuestDataToOwner(): Promise<void> {
  const guestId = getExistingSessionId()
  if (!guestId || guestId === OWNER_SESSION_ID) return
  await db.transaction(async (tx) => {
    await tx
      .update(conversations)
      .set({ sessionId: OWNER_SESSION_ID })
      .where(eq(conversations.sessionId, guestId))
    await tx
      .update(quizzes)
      .set({ sessionId: OWNER_SESSION_ID })
      .where(eq(quizzes.sessionId, guestId))
  })
}

export type OwnerLoginResult =
  | { ok: true; expiresAt: string }
  | { ok: false; error: string }

export async function ownerLoginImpl(passcodeInput: unknown): Promise<OwnerLoginResult> {
  const passcode = getPasscode()
  if (!passcode) {
    return { ok: false, error: 'Owner mode is not enabled on this server.' }
  }
  const input = typeof passcodeInput === 'string' ? passcodeInput.trim() : ''
  if (!input || !safeEqual(input, passcode)) {
    return { ok: false, error: 'Incorrect passcode' }
  }
  try {
    await moveGuestDataToOwner()
  } catch (err) {
    // The transaction rolled back, so nothing was moved; don't log in either.
    console.error('Owner login: moving guest data failed', err)
    return {
      ok: false,
      error: "Couldn't move this browser's chats to owner mode. Please try again.",
    }
  }
  const expiresAt = setOwnerCookie(passcode)
  return { ok: true, expiresAt: new Date(expiresAt).toISOString() }
}

export function ownerLogoutImpl(): void {
  deleteCookie(COOKIE_NAME, { path: '/' })
}
