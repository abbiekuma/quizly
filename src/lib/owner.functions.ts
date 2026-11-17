// src/lib/owner.functions.ts — owner mode server functions. Handlers load owner.server via
// dynamic import so the client bundle never includes the passcode logic.
import { createServerFn } from '@tanstack/react-start'

export const getOwnerStatus = createServerFn({ method: 'GET' }).handler(async () => {
  const m = await import('./owner.server')
  return m.getOwnerStatusImpl()
})

export const ownerLogin = createServerFn({ method: 'POST' })
  .validator((data: { passcode: string }) => data)
  .handler(async ({ data }) => {
    const m = await import('./owner.server')
    return m.ownerLoginImpl(data?.passcode)
  })

export const ownerLogout = createServerFn({ method: 'POST' }).handler(async () => {
  const m = await import('./owner.server')
  m.ownerLogoutImpl()
  return { ok: true }
})
