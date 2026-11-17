// src/lib/ai/generate.server.ts — chat replies and quiz generation for any provider. Server only.
import { generateText, Output } from 'ai'
import { z } from 'zod'
import {
  QUIZ_MCQ_GENERATION_SYSTEM,
  buildQuizMcqUserMessage,
  getSystemInstruction,
  type ChatMode,
} from '../prompts.server'
import { AiUserError, toFriendlyAiError } from './errors.server'
import type { ResolvedAiConfig } from './keys.server'
import { getLanguageModel } from './models.server'

export type { ChatMode } from '../prompts.server'

export type HistoryMessage = { role: 'user' | 'assistant'; content: string }

/**
 * Limits for every AI call. Without these a stuck or runaway request waits until
 * Vercel kills the function (300s).
 * - timeout: give up after 60s (the UI says so after 20s).
 * - maxRetries: 1 retry instead of the default 2, so a busy model fails faster.
 */
const CALL_LIMITS = { timeout: 60_000, maxRetries: 1 } as const

/** A 5-question quiz is ~1–2k tokens; this cap stops a model that keeps repeating itself. */
const QUIZ_MAX_OUTPUT_TOKENS = 4000

/** Chat reply for the given mode, with prior messages as history. */
export async function generateReply(params: {
  userMessage: string
  history: HistoryMessage[]
  mode: ChatMode
  ai: ResolvedAiConfig
}): Promise<string> {
  const { userMessage, history, mode, ai } = params
  try {
    const { text } = await generateText({
      model: getLanguageModel(ai),
      instructions: getSystemInstruction(mode),
      messages: [...history, { role: 'user', content: userMessage }],
      ...CALL_LIMITS,
    })
    if (!text.trim()) throw new AiUserError('The AI returned an empty reply.')
    return text
  } catch (err) {
    throw toFriendlyAiError(err, ai.provider, ai.model)
  }
}

// --- Quiz MCQ generation (structured output) ---

export type McqItem = {
  question: string
  options: Record<'A' | 'B' | 'C' | 'D', string>
  correctAnswer: 'A' | 'B' | 'C' | 'D'
}

// Root must be an object (some providers reject a top-level array).
// No min/max constraints in the schema: not every provider supports them, so we check after.
const quizSchema = z.object({
  questions: z.array(
    z.object({
      question: z.string().describe('The question text'),
      options: z.object({
        A: z.string(),
        B: z.string(),
        C: z.string(),
        D: z.string(),
      }),
      correctAnswer: z.enum(['A', 'B', 'C', 'D']),
    }),
  ),
})

/** Trim fields and drop incomplete questions; throw if nothing usable is left. */
function cleanQuestions(raw: z.infer<typeof quizSchema>['questions']): McqItem[] {
  const result: McqItem[] = []
  for (const q of raw) {
    const question = q.question.trim()
    const options = {
      A: q.options.A.trim(),
      B: q.options.B.trim(),
      C: q.options.C.trim(),
      D: q.options.D.trim(),
    }
    if (!question || !options.A || !options.B || !options.C || !options.D) continue
    result.push({ question, options, correctAnswer: q.correctAnswer })
  }
  if (result.length === 0) {
    throw new AiUserError('The AI did not return any usable questions. Please try again.')
  }
  return result
}

/** Generate MCQs from a conversation context string. */
export async function generateQuizMcqs(
  conversationContext: string,
  ai: ResolvedAiConfig,
): Promise<McqItem[]> {
  if (!conversationContext.trim()) {
    throw new AiUserError('Conversation context is empty; cannot generate quiz.')
  }
  let output: z.infer<typeof quizSchema>
  try {
    const result = await generateText({
      model: getLanguageModel(ai),
      instructions: QUIZ_MCQ_GENERATION_SYSTEM,
      prompt: buildQuizMcqUserMessage(conversationContext),
      output: Output.object({ schema: quizSchema, name: 'quiz' }),
      maxOutputTokens: QUIZ_MAX_OUTPUT_TOKENS,
      ...CALL_LIMITS,
    })
    output = result.output
  } catch (err) {
    throw toFriendlyAiError(err, ai.provider, ai.model)
  }
  return cleanQuestions(output.questions)
}
