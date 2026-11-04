// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'

import { getVisitorId } from './visitor'

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

describe('getVisitorId', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('creates a UUID and persists it', () => {
    const first = getVisitorId()

    expect(first).toMatch(UUID_PATTERN)
    expect(window.localStorage.getItem('stoic-quote-visitor')).toBe(first)
  })

  it('returns the same id on later calls', () => {
    const first = getVisitorId()

    expect(getVisitorId()).toBe(first)
  })
})
