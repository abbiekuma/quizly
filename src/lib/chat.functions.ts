// src/lib/chat.functions.ts — only createServerFn; handlers load impl via dynamic import so client never loads db/AI SDK.
import { createServerFn } from '@tanstack/react-start'
import {
  AI_PROVIDER_IDS,
  AI_PROVIDERS,
  type AiProviderId,
  type AiRequestConfig,
} from './ai/providers'

/** Who is calling: the owner (fixed id 'owner') or a guest (per-browser-session id). */
async function getCaller(): Promise<{ sessionId: string; isOwner: boolean }> {
  const owner = await import('./owner.server')
  if (owner.isOwnerRequest()) {
    return { sessionId: owner.OWNER_SESSION_ID, isOwner: true }
  }
  const m = await import('./anonymous-session.server')
  return { sessionId: m.getOrCreateSessionId(), isOwner: false }
}

async function getSessionId() {
  return (await getCaller()).sessionId
}

export const getConversations = createServerFn({ method: 'GET' }).handler(
  async () => {
    const sessionId = await getSessionId()
    const m = await import('./chat.impl.server')
    return m.getConversationsImpl(sessionId)
  },
)

export const getMessages = createServerFn({ method: 'GET' })
  .validator((data: { conversationId: number }) => data)
  .handler(async ({ data }) => {
    const sessionId = await getSessionId()
    const m = await import('./chat.impl.server')
    return m.getMessagesImpl(sessionId, data)
  })

export const getQuizQuestions = createServerFn({ method: 'GET' })
  .validator((data: { quizId: number }) => data)
  .handler(async ({ data }) => {
    const sessionId = await getSessionId()
    const q = await import('./quiz.service')
    return q.getQuizQuestionsImpl(sessionId, data)
  })

export const getQuizzes = createServerFn({ method: 'GET' })
  .validator((data: { conversationId: number }) => data)
  .handler(async ({ data }) => {
    const sessionId = await getSessionId()
    const q = await import('./quiz.service')
    return q.getQuizzesImpl(sessionId, data)
  })

export const submitQuizAnswer = createServerFn({ method: 'POST' })
  .validator(
    (data: { questionId: number; userAnswer: string }) =>
      data as { questionId: number; userAnswer: string },
  )
  .handler(async ({ data }) => {
    const sessionId = await getSessionId()
    const q = await import('./quiz.service')
    return q.submitQuizAnswerImpl(sessionId, data)
  })

export const updateQuizSaved = createServerFn({ method: 'POST' })
  .validator(
    (data: { quizId: number; isSaved: boolean }) =>
      data as { quizId: number; isSaved: boolean },
  )
  .handler(async ({ data }) => {
    const sessionId = await getSessionId()
    const q = await import('./quiz.service')
    return q.updateQuizSavedImpl(sessionId, data)
  })

export const getAllQuizzesGroupedByConversation = createServerFn({
  method: 'GET',
}).handler(async () => {
  const sessionId = await getSessionId()
  const q = await import('./quiz.service')
  return q.getAllQuizzesGroupedByConversationImpl(sessionId)
})

export const getSavedQuizzes = createServerFn({ method: 'GET' }).handler(
  async () => {
    const sessionId = await getSessionId()
    const q = await import('./quiz.service')
    return q.getSavedQuizzesImpl(sessionId)
  },
)

export const getQuizById = createServerFn({ method: 'GET' })
  .validator((data: { quizId: number }) => data)
  .handler(async ({ data }) => {
    const sessionId = await getSessionId()
    const q = await import('./quiz.service')
    return q.getQuizByIdImpl(sessionId, data)
  })

export const sendMessage = createServerFn({ method: 'POST' })
  .validator(
    (data: {
      conversationId?: number
      userMessage: string
      mode: 'beginner' | 'deep-dive' | 'quiz'
      ai: AiRequestConfig
      quizAction?: 'generate' | 'follow-up'
      activeQuizId?: number
    }) =>
      data as {
        conversationId?: number
        userMessage: string
        mode: 'beginner' | 'deep-dive' | 'quiz'
        ai: AiRequestConfig
        quizAction?: 'generate' | 'follow-up'
        activeQuizId?: number
      },
  )
  .handler(async ({ data }) => {
    const { sessionId, isOwner } = await getCaller()
    const m = await import('./chat.impl.server')
    return m.sendMessageImpl(sessionId, isOwner, data)
  })

export const deleteConversation = createServerFn({ method: 'POST' })
  .validator((data: { conversationId: number }) => data)
  .handler(async ({ data }) => {
    const sessionId = await getSessionId()
    const m = await import('./chat.impl.server')
    return m.deleteConversationImpl(sessionId, data)
  })

/**
 * Which providers have an API key in server env. Never returns the keys.
 * Only the owner can use them, so guests always get all false (we don't reveal what is set).
 */
export const getAiKeyStatus = createServerFn({ method: 'GET' }).handler(
  async () => {
    const owner = await import('./owner.server')
    const isOwner = owner.isOwnerRequest()
    const status = {} as Record<AiProviderId, boolean>
    for (const id of AI_PROVIDER_IDS) {
      status[id] = isOwner && Boolean(process.env[AI_PROVIDERS[id].envVar]?.trim())
    }
    return { serverKeys: status }
  },
)
