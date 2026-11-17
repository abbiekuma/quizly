// src/components/ModelSwitcher.tsx — quick provider/model switch next to the chat input.
// Lists only providers that have a key (browser or server); the current choice is always shown.
import { useAiSettings } from '../contexts/AiSettingsContext'
import {
  AI_PROVIDER_IDS,
  AI_PROVIDERS,
  isAiProviderId,
  type AiModelOption,
} from '../lib/ai/providers'

const SEP = '::'

export function ModelSwitcher({ disabled }: { disabled?: boolean }) {
  const { provider, model, models, keyStatus, selectModel } = useAiSettings()

  const groups = AI_PROVIDER_IDS.filter(
    (id) => id === provider || keyStatus[id].isReady,
  ).map((id) => {
    const info = AI_PROVIDERS[id]
    const options: AiModelOption[] = [...info.models]
    // Keep a custom model (set in Settings) in the list.
    const remembered = id === provider ? model : models[id]
    if (remembered && !options.some((m) => m.id === remembered)) {
      options.push({ id: remembered, label: remembered })
    }
    return { id, label: info.label, options }
  })

  return (
    <select
      value={`${provider}${SEP}${model}`}
      onChange={(e) => {
        const [p, ...rest] = e.target.value.split(SEP)
        const m = rest.join(SEP)
        if (isAiProviderId(p) && m) selectModel(p, m)
      }}
      disabled={disabled}
      aria-label="AI model"
      title="AI model (only providers with a key are listed; manage in Settings)"
      className="ml-auto max-w-[14rem] truncate rounded-lg border border-border bg-input px-2 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
    >
      {groups.map((g) => (
        <optgroup key={g.id} label={g.label}>
          {g.options.map((m) => (
            <option key={m.id} value={`${g.id}${SEP}${m.id}`}>
              {g.label} · {m.label}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  )
}
