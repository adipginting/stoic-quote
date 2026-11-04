import '@tanstack/react-start/server-only'

import type {
  Explanation,
  Favourites,
  Meta,
  Quote,
  QuoteImage,
  RandomQuoteFilters,
} from './types'
import { logger } from './logger.server'

export type {
  Explanation,
  Favourites,
  Meta,
  Quote,
  QuoteImage,
  RandomQuoteFilters,
} from './types'

const REQUEST_TIMEOUT_MS = 10_000
const DEFAULT_API_URL = 'http://localhost:3000'

export class ApiError extends Error {
  status: number | undefined

  constructor(message: string, status?: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

function getApiUrl() {
  return process.env.API_URL ?? DEFAULT_API_URL
}

async function request<T>(path: string, init?: RequestInit): Promise<T | null> {
  let response: Response

  try {
    response = await fetch(`${getApiUrl()}${path}`, {
      ...init,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    })
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error)
    logger.error({ path, err: reason }, 'quote api unreachable')
    throw new ApiError(`Could not reach the quote API at ${path}: ${reason}`)
  }

  if (response.status === 404 || response.status === 503) {
    return null
  }

  if (!response.ok) {
    logger.warn(
      { path, status: response.status, statusText: response.statusText },
      'quote api request failed',
    )
    throw new ApiError(
      `Quote API request failed at ${path}: ${response.status} ${response.statusText}`,
      response.status,
    )
  }

  if (response.status === 204) {
    return null
  }

  const body = await response.text()
  if (body.length === 0) {
    return null
  }

  try {
    return JSON.parse(body) as T
  } catch {
    logger.warn(
      { path, status: response.status },
      'quote api returned invalid json',
    )
    throw new ApiError(`Quote API returned invalid JSON at ${path}`, response.status)
  }
}

export function getMeta() {
  return request<Meta>('/v2/meta')
}

export function getDailyQuote(date?: string) {
  const query = date ? `?date=${encodeURIComponent(date)}` : ''
  return request<Quote>(`/v2/quotes/daily${query}`)
}

export function getRandomQuote(filters: RandomQuoteFilters = {}) {
  const params = new URLSearchParams()

  if (filters.tag) params.set('tag', filters.tag)
  if (filters.work) params.set('work', filters.work)
  if (filters.minLength !== undefined) {
    params.set('minLength', String(filters.minLength))
  }
  if (filters.maxLength !== undefined) {
    params.set('maxLength', String(filters.maxLength))
  }

  const query = params.size > 0 ? `?${params.toString()}` : ''
  return request<Quote>(`/v2/quotes/random${query}`)
}

export function getQuoteById(id: string) {
  return request<Quote>(`/v2/quotes/${encodeURIComponent(id)}`)
}

export function getExplanation(id: string) {
  return request<Explanation>(`/v2/quotes/${encodeURIComponent(id)}/explanation`)
}

export function getImage(id: string) {
  return request<QuoteImage>(`/v2/quotes/${encodeURIComponent(id)}/image`)
}

export function getFavourites(visitorId: string) {
  return request<Favourites>('/v2/favourites', {
    headers: { 'x-visitor-id': visitorId },
  })
}

export async function addFavourite(visitorId: string, quoteId: string) {
  await request<unknown>('/v2/favourites', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-visitor-id': visitorId,
    },
    body: JSON.stringify({ quoteId }),
  })

  return { ok: true }
}

export async function removeFavourite(visitorId: string, quoteId: string) {
  await request<unknown>(`/v2/favourites/${encodeURIComponent(quoteId)}`, {
    method: 'DELETE',
    headers: { 'x-visitor-id': visitorId },
  })

  return { ok: true }
}
