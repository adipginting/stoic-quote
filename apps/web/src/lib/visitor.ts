import { useEffect, useState } from 'react'

const VISITOR_STORAGE_KEY = 'stoic-quote-visitor'

export function getVisitorId(): string | null {
  if (typeof window === 'undefined') return null

  try {
    const stored = window.localStorage.getItem(VISITOR_STORAGE_KEY)
    if (stored) return stored

    const created = crypto.randomUUID()
    window.localStorage.setItem(VISITOR_STORAGE_KEY, created)
    return created
  } catch {
    return null
  }
}

export function useVisitorId(): string | null {
  const [visitorId, setVisitorId] = useState<string | null>(null)

  useEffect(() => {
    setVisitorId(getVisitorId())
  }, [])

  return visitorId
}
