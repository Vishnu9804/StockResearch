/**
 * Research Chat API client — backend/routers/chat.py.
 *
 * Kept in its own module rather than added to finscreenApi.ts because chat is
 * the one feature whose calls are long-running: /ask waits on a real model
 * round trip, so it needs its own axios instance with a much longer timeout
 * than the rest of the app should ever tolerate.
 */
import axios from 'axios'
import { supabase } from './supabaseClient'

/** The three language levels. LANGUAGE only — never research depth. */
export type LanguageLevel = 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED'

export interface LanguageLevelOption {
  value: LanguageLevel
  label: string
  /** One short line shown under the label in the dropdown. */
  hint: string
}

/**
 * Shown in the composer dropdown. The wording is deliberate: each hint
 * describes HOW THE ANSWER READS, never how good it is, because the level
 * genuinely does not change retrieval or accuracy (see
 * backend/agents/research_chat/prompts.py). A hint like "deeper analysis"
 * would be a lie the backend does not implement.
 */
export const LANGUAGE_LEVELS: LanguageLevelOption[] = [
  { value: 'BEGINNER',     label: 'New to markets',  hint: 'Everyday words. Every market term explained.' },
  { value: 'INTERMEDIATE', label: 'Knows the basics', hint: 'Normal market vocabulary, light explanations.' },
  { value: 'ADVANCED',     label: 'Analyst level',    hint: 'Full technical vocabulary, dense and direct.' },
]

export interface Citation {
  n: number
  sourceType: 'COMPANY_PROFILE' | 'COMPANY_FUNDAMENTALS' | 'TRANSCRIPT' | 'NEWS' | 'PLATFORM_HELP'
  sourceLabel: string
  title: string | null
  url: string | null
  symbol: string | null
  date: string | null
  detail: string | null
}

export interface ChatMessageDto {
  id: string
  role: 'user' | 'assistant'
  content: string
  languageLevel: LanguageLevel | null
  citations: Citation[]
  latencyMs: number | null
  createdAt: string
}

export interface ConversationDto {
  id: string
  title: string
  languageLevel: LanguageLevel
  messageCount: number
  lastMessageAt: string | null
  createdAt: string
  updatedAt: string
}

export interface AskResponse {
  conversationId: string
  userMessage: ChatMessageDto
  assistantMessage: ChatMessageDto
}

export interface IndexStats {
  embeddingModel: string
  embeddingDim: number
  chatModel: string
  ready: boolean
  totalDocuments: number
  totalChunks: number
  bySourceType: Record<string, { documents: number; chunks: number; lastIndexedAt: string | null }>
}

const chatClient = axios.create({
  baseURL: '/api/chat',
  headers: { 'Content-Type': 'application/json' },
  // Generous on purpose. A question about a company nothing is indexed for
  // yet triggers an on-demand index before it can answer, and the free-tier
  // embedding endpoint paces itself — the request is genuinely slow, and
  // timing out at the client would abandon work the server is still doing.
  timeout: 180_000,
})

chatClient.interceptors.request.use(async (config) => {
  const { data: { session } } = await supabase.auth.getSession()
  if (session?.access_token) {
    config.headers.Authorization = `Bearer ${session.access_token}`
  }
  return config
}, (error) => Promise.reject(error))

export const chatApi = {
  listConversations: () =>
    chatClient.get('/conversations').then(r => r.data as { success: boolean; conversations: ConversationDto[] }),

  getConversation: (id: string) =>
    chatClient.get(`/conversations/${id}`).then(
      r => r.data as { conversation: ConversationDto; messages: ChatMessageDto[] },
    ),

  deleteConversation: (id: string) =>
    chatClient.delete(`/conversations/${id}`).then(r => r.data),

  /** Omit conversationId to start a new thread; the response says which id was used. */
  ask: (message: string, languageLevel: LanguageLevel, conversationId?: string) =>
    chatClient.post('/ask', { message, languageLevel, conversationId: conversationId ?? null })
      .then(r => r.data as AskResponse),

  indexStats: () => chatClient.get('/index/stats').then(r => r.data as IndexStats),
}

export default chatApi
