import { createFileRoute } from '@tanstack/react-router'

import { ErrorState } from '#/components/page-state'
import { QuoteExperience } from '#/components/quote-experience'
import { getDailyQuote, getImage, getMeta } from '#/lib/functions'
import type { QuoteImage } from '#/lib/types'

export const Route = createFileRoute('/')({
  loader: async () => {
    const [quote, meta] = await Promise.all([getDailyQuote(), getMeta()])

    if (!quote) {
      throw new Error('The quote of the day is unavailable right now.')
    }

    let image: QuoteImage | null = null
    try {
      image = await getImage({ data: { id: quote.id } })
    } catch {
      image = null
    }

    return { quote, image, meta }
  },
  head: () => ({
    meta: [
      { title: 'Stoic Quote — a daily quote from the Stoics' },
      {
        name: 'description',
        content:
          'A daily quote from Marcus Aurelius, Epictetus and Seneca, with sources, explanations and photography.',
      },
    ],
  }),
  component: Home,
  errorComponent: ({ error }) => (
    <ErrorState
      title="Could not load today's quote"
      message={
        error instanceof Error
          ? error.message
          : 'Please check the quote service and try again.'
      }
    />
  ),
})

function Home() {
  const { quote, image, meta } = Route.useLoaderData()

  return (
    <QuoteExperience
      key={quote.id}
      initialQuote={quote}
      initialImage={image}
      canExplain={meta?.capabilities.explain ?? false}
      enableRandom
    />
  )
}
