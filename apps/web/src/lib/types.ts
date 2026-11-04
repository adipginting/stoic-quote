export type Quote = {
  id: string
  text: string
  author: string
  work: string
  section: string | null
  translation: string
  tags: string[]
}

export type Explanation = {
  quoteId: string
  model: string
  promptVersion: string
  text: string
  createdAt: string
}

export type QuoteImage = {
  quoteId: string
  query: string
  url: string
  thumbUrl: string
  ogUrl: string
  color: string
  alt: string
  photographer: {
    name: string
    username: string
    profileUrl: string
  }
  unsplashUrl: string
}

export type Meta = {
  name: string
  version: string
  quoteCount: number
  capabilities: {
    explain: boolean
    images: boolean
  }
  works: string[]
}

export type Favourites = {
  ids: string[]
  quotes: Quote[]
}

export type RandomQuoteFilters = {
  tag?: string
  work?: string
  minLength?: number
  maxLength?: number
}
