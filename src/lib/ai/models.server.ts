// src/lib/ai/models.server.ts — build an AI SDK model for a provider. Server only.
import type { LanguageModel } from 'ai'
import { createAnthropic } from '@ai-sdk/anthropic'
import { createDeepSeek } from '@ai-sdk/deepseek'
import { createGoogle } from '@ai-sdk/google'
import { createOpenAI } from '@ai-sdk/openai'
import type { ResolvedAiConfig } from './keys.server'

export function getLanguageModel(config: ResolvedAiConfig): LanguageModel {
  const { provider, model, apiKey } = config
  switch (provider) {
    case 'google':
      return createGoogle({ apiKey })(model)
    case 'anthropic':
      return createAnthropic({ apiKey })(model)
    case 'openai':
      return createOpenAI({ apiKey })(model)
    case 'deepseek':
      return createDeepSeek({ apiKey })(model)
  }
}
