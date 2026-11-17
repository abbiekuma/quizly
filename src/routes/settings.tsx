import { createFileRoute, Link } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { CheckCircle2 } from 'lucide-react'
import { useAiSettings } from '../contexts/AiSettingsContext'
import {
  AI_PROVIDER_IDS,
  AI_PROVIDERS,
  isAiProviderId,
  type AiProviderId,
} from '../lib/ai/providers'

export const Route = createFileRoute('/settings')({
  component: SettingsPage,
})

const CUSTOM_MODEL = '__custom__'

function SettingsPage() {
  return (
    <div className="mx-auto max-w-lg p-6">
      <h1 className="mb-2 text-2xl font-semibold text-stone-900">Settings</h1>
      <p className="mb-6 text-sm text-stone-600">
        Quizly uses <strong>bring-your-own-key</strong>. API keys are stored in
        this browser tab&apos;s session only (cleared when you close the
        browser). They are sent over HTTPS when you chat but are{' '}
        <strong>not saved on our server</strong>. Your provider and model
        choice is remembered in this browser.
      </p>

      <ModelSection />

      <h2 className="mb-1 text-lg font-semibold text-stone-900">API keys</h2>
      <p className="mb-4 text-sm text-stone-600">
        Add a key for each provider you want to use. The quick switch next to
        the chat box only lists providers that have a key.
      </p>
      <div className="mb-6 space-y-4">
        {AI_PROVIDER_IDS.map((id) => (
          <ProviderKeyRow key={id} provider={id} />
        ))}
      </div>

      <div className="mb-6 rounded-lg border border-primary-muted bg-primary-muted/50 p-4 text-sm text-primary-muted-foreground">
        <p className="font-medium">Chats are private to this browser session</p>
        <p className="mt-1 text-primary-muted-foreground">
          Closing the browser starts fresh. Other visitors cannot see your
          conversations.
        </p>
      </div>

      <Link
        to="/"
        className="inline-block rounded-lg border border-stone-300 px-4 py-2 text-stone-700 hover:bg-sidebar-surface"
      >
        Back to chat
      </Link>
    </div>
  )
}

function ModelSection() {
  const { provider, model, setProvider, setModel, keyStatus, ready } =
    useAiSettings()
  const info = AI_PROVIDERS[provider]
  const isPreset = info.models.some((m) => m.id === model)
  const [customMode, setCustomMode] = useState(false)
  const [customInput, setCustomInput] = useState('')

  // When the provider or saved model changes, show the custom box only for non-preset models.
  useEffect(() => {
    setCustomMode(!isPreset)
    setCustomInput(isPreset ? '' : model)
  }, [provider, model, isPreset])

  const handleModelSelect = (value: string) => {
    if (value === CUSTOM_MODEL) {
      setCustomMode(true)
      setCustomInput('')
      return
    }
    setCustomMode(false)
    setModel(provider, value)
  }

  const handleCustomSave = () => {
    const trimmed = customInput.trim()
    if (trimmed) setModel(provider, trimmed)
  }

  const selectClass =
    'w-full rounded-lg border border-stone-300 bg-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-ring'

  return (
    <section className="mb-8">
      <h2 className="mb-3 text-lg font-semibold text-stone-900">AI model</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm font-medium text-stone-700">
          Provider
          <select
            value={provider}
            onChange={(e) => {
              if (isAiProviderId(e.target.value)) setProvider(e.target.value)
            }}
            className={`mt-1 ${selectClass}`}
          >
            {AI_PROVIDER_IDS.map((id) => (
              <option key={id} value={id}>
                {AI_PROVIDERS[id].label}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm font-medium text-stone-700">
          Model
          <select
            value={customMode ? CUSTOM_MODEL : model}
            onChange={(e) => handleModelSelect(e.target.value)}
            className={`mt-1 ${selectClass}`}
          >
            {info.models.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
            <option value={CUSTOM_MODEL}>Custom…</option>
          </select>
        </label>
      </div>

      {customMode ? (
        <div className="mt-3">
          <label className="mb-1 block text-sm font-medium text-stone-700">
            Custom model id
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={customInput}
              onChange={(e) => setCustomInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCustomSave()}
              placeholder={`e.g. ${info.defaultModel}`}
              className="flex-1 rounded-lg border border-stone-300 px-3 py-2 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <button
              type="button"
              onClick={handleCustomSave}
              disabled={!customInput.trim() || customInput.trim() === model}
              className="rounded-lg bg-primary px-4 py-2 text-primary-foreground hover:bg-primary-hover disabled:opacity-50"
            >
              Use
            </button>
          </div>
          <p className="mt-1 text-xs text-stone-500">
            Use the exact model id from the provider&apos;s docs.
          </p>
        </div>
      ) : null}

      <p className="mt-3 text-sm text-stone-600">
        Using{' '}
        <code className="rounded bg-stone-100 px-1">
          {info.label} / {model}
        </code>
        {ready && !keyStatus[provider].isReady ? (
          <span className="text-amber-800"> — add a {info.label} key below.</span>
        ) : null}
      </p>
    </section>
  )
}

function ProviderKeyRow({ provider }: { provider: AiProviderId }) {
  const { keyStatus, saveKey, removeKey } = useAiSettings()
  const info = AI_PROVIDERS[provider]
  const { maskedKey, hasServerKey } = keyStatus[provider]
  const [input, setInput] = useState('')
  const [saved, setSaved] = useState(false)

  const handleSave = () => {
    const trimmed = input.trim()
    if (!trimmed) return
    saveKey(provider, trimmed)
    setInput('')
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="rounded-lg border border-stone-200 p-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="font-medium text-stone-900">{info.label}</span>
        <a
          href={info.keyUrl}
          target="_blank"
          rel="noreferrer"
          className="text-xs text-primary-muted-foreground underline"
        >
          Get a key
        </a>
      </div>

      {hasServerKey ? (
        <p className="mb-2 flex items-start gap-2 text-sm text-amber-900">
          <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-amber-800" aria-hidden />
          <span>
            Connected via server environment (
            <code className="rounded bg-amber-100/80 px-1">{info.envVar}</code>
            ). A key saved here overrides it for this session.
          </span>
        </p>
      ) : null}

      {maskedKey ? (
        <p className="mb-2 text-sm text-stone-600">
          Session key: <code className="rounded bg-stone-100 px-1">{maskedKey}</code>
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <input
          type="password"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSave()}
          placeholder={maskedKey ? 'Paste a new key to replace' : `Paste your ${info.label} API key`}
          aria-label={`${info.label} API key`}
          className="min-w-0 flex-1 rounded-lg border border-stone-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <button
          type="button"
          onClick={handleSave}
          disabled={!input.trim()}
          className="rounded-lg bg-primary px-4 py-2 text-primary-foreground hover:bg-primary-hover disabled:opacity-50"
        >
          Save
        </button>
        {maskedKey ? (
          <button
            type="button"
            onClick={() => removeKey(provider)}
            className="rounded-lg border border-stone-300 px-4 py-2 text-stone-700 hover:bg-sidebar-surface"
          >
            Remove
          </button>
        ) : null}
      </div>
      {saved ? (
        <p className="mt-2 text-sm text-primary-muted-foreground">Key saved for this session.</p>
      ) : null}
    </div>
  )
}
