import { afterEach, describe, expect, it, vi } from 'vitest'

import { ApiError, getMeta, getQuoteById } from './api'

function stubFetch(impl: () => Promise<Response>) {
  vi.stubGlobal('fetch', vi.fn(impl))
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('api client', () => {
  it('parses JSON on success', async () => {
    stubFetch(
      async () =>
        new Response(JSON.stringify({ name: 'Stoic Quote API' }), {
          status: 200,
        }),
    )

    await expect(getMeta()).resolves.toEqual({ name: 'Stoic Quote API' })
  })

  it('returns null for 404 and 503', async () => {
    stubFetch(async () => new Response('', { status: 404 }))

    await expect(getQuoteById('missing')).resolves.toBeNull()
  })

  it('throws ApiError carrying the status on other errors', async () => {
    stubFetch(
      async () =>
        new Response('boom', { status: 500, statusText: 'Server Error' }),
    )

    await expect(getMeta()).rejects.toMatchObject({
      name: 'ApiError',
      status: 500,
    })
  })

  it('throws ApiError when the API is unreachable', async () => {
    stubFetch(() => Promise.reject(new Error('fetch failed')))

    await expect(getMeta()).rejects.toBeInstanceOf(ApiError)
  })

  it('throws ApiError on invalid JSON', async () => {
    stubFetch(async () => new Response('not json', { status: 200 }))

    await expect(getMeta()).rejects.toMatchObject({ name: 'ApiError' })
  })

  it('returns null for an empty body', async () => {
    stubFetch(async () => new Response(null, { status: 204 }))

    await expect(getMeta()).resolves.toBeNull()
  })
})
