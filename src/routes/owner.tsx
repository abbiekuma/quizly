// src/routes/owner.tsx — hidden owner page (not linked from the site; bookmark it).
// Unlock with OWNER_PASSCODE, see status, log out.
import { createFileRoute, Link } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { useState } from 'react'
import { CheckCircle2, KeyRound, XCircle } from 'lucide-react'
import { useAiSettings } from '../contexts/AiSettingsContext'
import { AI_PROVIDER_IDS, AI_PROVIDERS } from '../lib/ai/providers'
import { ownerLogin, ownerLogout } from '../lib/owner.functions'

export const Route = createFileRoute('/owner')({
  head: () => ({ meta: [{ name: 'robots', content: 'noindex, nofollow' }] }),
  component: OwnerPage,
})

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function OwnerPage() {
  const { ownerStatus, keyStatus, refreshServerStatus } = useAiSettings()
  const loginFn = useServerFn(ownerLogin)
  const logoutFn = useServerFn(ownerLogout)
  const [passcode, setPasscode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const handleUnlock = async () => {
    if (!passcode.trim() || busy) return
    setBusy(true)
    setError(null)
    try {
      const result = await loginFn({ data: { passcode } })
      if (result.ok) {
        setPasscode('')
        await refreshServerStatus()
      } else {
        setError(result.error)
      }
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  const handleLogout = async () => {
    setBusy(true)
    try {
      await logoutFn()
      await refreshServerStatus()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-lg p-6">
      <h1 className="mb-6 flex items-center gap-2 text-2xl font-semibold text-stone-900">
        <KeyRound size={22} aria-hidden />
        Owner
      </h1>

      {ownerStatus == null ? (
        <p className="text-sm text-stone-500">Loading…</p>
      ) : !ownerStatus.enabled ? (
        <p className="rounded-lg border border-stone-200 p-4 text-sm text-stone-600">
          Owner mode is not enabled on this server (<code>OWNER_PASSCODE</code>{' '}
          is not set).
        </p>
      ) : ownerStatus.isOwner ? (
        <div className="rounded-lg border border-stone-200 p-4">
          <p className="flex items-center gap-2 font-medium text-stone-900">
            <CheckCircle2 size={18} className="text-primary" aria-hidden />
            Owner mode on
          </p>
          {ownerStatus.expiresAt ? (
            <p className="mt-2 text-sm text-stone-600">
              Valid until {formatDate(ownerStatus.expiresAt)} (renews
              automatically when you use the app).
            </p>
          ) : null}

          <p className="mt-4 mb-2 text-sm font-medium text-stone-700">
            Server API keys
          </p>
          <ul className="mb-4 space-y-1 text-sm text-stone-600">
            {AI_PROVIDER_IDS.map((id) => (
              <li key={id} className="flex items-center gap-2">
                {keyStatus[id].hasServerKey ? (
                  <CheckCircle2 size={16} className="text-primary" aria-hidden />
                ) : (
                  <XCircle size={16} className="text-stone-400" aria-hidden />
                )}
                {AI_PROVIDERS[id].label}
                {!keyStatus[id].hasServerKey ? (
                  <span className="text-xs text-stone-400">
                    (set <code>{AI_PROVIDERS[id].envVar}</code>)
                  </span>
                ) : null}
              </li>
            ))}
          </ul>

          <div className="flex flex-wrap gap-2">
            <Link
              to="/"
              className="rounded-lg bg-primary px-4 py-2 text-primary-foreground hover:bg-primary-hover"
            >
              Go to chat
            </Link>
            <button
              type="button"
              onClick={handleLogout}
              disabled={busy}
              className="rounded-lg border border-stone-300 px-4 py-2 text-stone-700 hover:bg-sidebar-surface disabled:opacity-50"
            >
              Log out
            </button>
          </div>
        </div>
      ) : (
        <div className="rounded-lg border border-stone-200 p-4">
          <label
            htmlFor="owner-passcode"
            className="mb-2 block text-sm font-medium text-stone-700"
          >
            Passcode
          </label>
          <div className="flex flex-wrap gap-2">
            <input
              id="owner-passcode"
              type="password"
              autoComplete="current-password"
              value={passcode}
              onChange={(e) => setPasscode(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleUnlock()}
              className="min-w-0 flex-1 rounded-lg border border-stone-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <button
              type="button"
              onClick={handleUnlock}
              disabled={busy || !passcode.trim()}
              className="rounded-lg bg-primary px-4 py-2 text-primary-foreground hover:bg-primary-hover disabled:opacity-50"
            >
              {busy ? 'Unlocking…' : 'Unlock'}
            </button>
          </div>
          {error ? <p className="mt-2 text-sm text-red-700">{error}</p> : null}
          <p className="mt-3 text-xs text-stone-500">
            Unlocking keeps your chats and quizzes across browsers and lets you
            use the API keys set on the server. Chats from this browser
            session move to owner mode.
          </p>
        </div>
      )}
    </div>
  )
}
