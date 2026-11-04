import { createServerFn } from '@tanstack/react-start'

import {
  addFavourite as addFavouriteRequest,
  getDailyQuote as getDailyQuoteRequest,
  getExplanation as getExplanationRequest,
  getFavourites as getFavouritesRequest,
  getImage as getImageRequest,
  getMeta as getMetaRequest,
  getQuoteById as getQuoteByIdRequest,
  getRandomQuote as getRandomQuoteRequest,
  removeFavourite as removeFavouriteRequest,
} from './api'
import type { RandomQuoteFilters } from './types'

export const getMeta = createServerFn({ method: 'GET' }).handler(() =>
  getMetaRequest(),
)

export const getDailyQuote = createServerFn({ method: 'GET' })
  .validator((data: { date?: string } | undefined) => data ?? {})
  .handler(({ data }) => getDailyQuoteRequest(data.date))

export const getRandomQuote = createServerFn({ method: 'GET' })
  .validator((data: RandomQuoteFilters | undefined) => data ?? {})
  .handler(({ data }) => getRandomQuoteRequest(data))

export const getQuoteById = createServerFn({ method: 'GET' })
  .validator((data: { id: string }) => data)
  .handler(({ data }) => getQuoteByIdRequest(data.id))

export const getExplanation = createServerFn({ method: 'GET' })
  .validator((data: { id: string }) => data)
  .handler(({ data }) => getExplanationRequest(data.id))

export const getImage = createServerFn({ method: 'GET' })
  .validator((data: { id: string }) => data)
  .handler(({ data }) => getImageRequest(data.id))

export const getFavourites = createServerFn({ method: 'GET' })
  .validator((data: { visitorId: string }) => data)
  .handler(({ data }) => getFavouritesRequest(data.visitorId))

export const addFavourite = createServerFn({ method: 'POST' })
  .validator((data: { visitorId: string; quoteId: string }) => data)
  .handler(({ data }) => addFavouriteRequest(data.visitorId, data.quoteId))

export const removeFavourite = createServerFn({ method: 'POST' })
  .validator((data: { visitorId: string; quoteId: string }) => data)
  .handler(({ data }) => removeFavouriteRequest(data.visitorId, data.quoteId))
