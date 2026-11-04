import { createFileRoute, notFound } from '@tanstack/react-router'

import { ErrorState, NotFoundState } from '#/components/page-state'
import { QuoteExperience } from '#/components/quote-experience'
import { getImage, getMeta, getQuoteById } from '#/lib/functions'
import type { QuoteImage } from '#/lib/types'

export const Route = createFileRoute('/q/$id')({
  loader: async ({ params }) => {
    const [quote, meta] = await Promise.all([
      getQuoteById({ data: { id: params.id } }),
      getMeta(),
    ])

    if (!quote) {
      throw notFound()
    }

    let image: QuoteImage | null = null
    try {
      image = await getImage({ data: { id: quote.id } })
    } catch {
      image = null
    }

    return { quote, image, meta }
  },
  head: ({ loaderData }) => {
    const quote = loaderData?.quote

    if (!quote) {
      return {
        meta: [{ title: 'Quote not found — Stoic Quote' }],
      }
    }

    const meta: Array<Record<string, string>> = [
      { title: `${quote.text} — ${quote.author} | Stoic Quote` },
      { name: 'description', content: `${quote.text} — ${quote.author}, ${quote.work}` },
      { property: 'og:title', content: `${quote.author}, ${quote.work}` },
      { property: 'og:description', content: quote.text },
      { property: 'og:type', content: 'article' },
    ]

    if (loaderData?.image?.ogUrl) {
      meta.push({ property: 'og:image', content: loaderData.image.ogUrl })
    }

    return { meta }
  },
  component: QuoteDetail,
  notFoundComponent: () => (
    <NotFoundState
      title="Quote not found"
      message="We could not find that quote. It may have been removed, or the link may be wrong."
    />
  ),
  errorComponent: ({ error }) => (
    <ErrorState
      title="Could not load this quote"
      message={
        error instanceof Error
          ? error.message
          : 'Please check the quote service and try again.'
      }
    />
  ),
})

function QuoteDetail() {
  const { quote, image, meta } = Route.useLoaderData()

  return (
    <QuoteExperience
      key={quote.id}
      initialQuote={quote}
      initialImage={image}
      canExplain={meta?.capabilities.explain ?? false}
    />
  )
}
