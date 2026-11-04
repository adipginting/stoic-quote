import { useEffect, useState } from 'react'
import { Link, createFileRoute } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'

import { PhotoCredit } from '#/components/quote-experience'
import { getFavourites, getImage, removeFavourite } from '#/lib/functions'
import type { Quote, QuoteImage } from '#/lib/types'
import { useVisitorId } from '#/lib/visitor'

export const Route = createFileRoute('/favourites')({
  head: () => ({
    meta: [
      { title: 'Favourites — Stoic Quote' },
      { name: 'description', content: 'The Stoic quotes you have saved.' },
      { name: 'robots', content: 'noindex' },
    ],
  }),
  component: Favourites,
})

type FavouriteItem = {
  quote: Quote
  image: QuoteImage | null
}

type Status = 'loading' | 'ready' | 'error'

function Favourites() {
  const visitorId = useVisitorId()
  const fetchFavourites = useServerFn(getFavourites)
  const fetchImage = useServerFn(getImage)
  const deleteFavourite = useServerFn(removeFavourite)

  const [status, setStatus] = useState<Status>('loading')
  const [items, setItems] = useState<FavouriteItem[]>([])
  const [removingId, setRemovingId] = useState<string | null>(null)
  const [removeErrorId, setRemoveErrorId] = useState<string | null>(null)

  useEffect(() => {
    const id = visitorId
    if (!id) return

    let cancelled = false
    setStatus('loading')

    const loadFavourites = async () => {
      try {
        const result = await fetchFavourites({ data: { visitorId: id } })

        if (cancelled) return

        if (!result) {
          setItems([])
          setStatus('ready')
          return
        }

        const withImages = await Promise.all(
          result.quotes.map(async (quote) => {
            try {
              const image = await fetchImage({ data: { id: quote.id } })
              return { quote, image }
            } catch {
              return { quote, image: null }
            }
          }),
        )

        if (!cancelled) {
          setItems(withImages)
          setStatus('ready')
        }
      } catch {
        if (!cancelled) setStatus('error')
      }
    }

    void loadFavourites()

    return () => {
      cancelled = true
    }
  }, [visitorId, fetchFavourites, fetchImage])

  async function handleRemove(quoteId: string) {
    if (!visitorId || removingId) return

    setRemovingId(quoteId)
    setRemoveErrorId(null)

    try {
      await deleteFavourite({ data: { visitorId, quoteId } })
      setItems((previous) => previous.filter((item) => item.quote.id !== quoteId))
    } catch {
      setRemoveErrorId(quoteId)
    } finally {
      setRemovingId(null)
    }
  }

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-10 sm:px-6 sm:py-14">
      <h1 className="font-serif text-3xl text-stone-50 sm:text-4xl">Favourites</h1>
      <p className="mt-2 text-sm text-stone-400">
        Quotes you have saved on this device.
      </p>

      {status === 'loading' ? (
        <p className="mt-8 text-sm text-stone-400" role="status">
          Loading your favourites…
        </p>
      ) : null}

      {status === 'error' ? (
        <p className="mt-8 text-sm text-amber-200" role="alert">
          Could not load your favourites. Please try again in a moment.
        </p>
      ) : null}

      {status === 'ready' && items.length === 0 ? (
        <div className="mt-10 rounded-2xl border border-stone-800 bg-stone-900/40 p-8 text-center">
          <p className="text-stone-300">You have not saved any quotes yet.</p>
          <Link
            to="/"
            className="mt-4 inline-block rounded-full border border-amber-300/40 bg-amber-300/10 px-4 py-2 text-sm text-amber-200 transition hover:bg-amber-300/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300"
          >
            Read today&apos;s quote
          </Link>
        </div>
      ) : null}

      {status === 'ready' && items.length > 0 ? (
        <ul className="mt-8 flex flex-col gap-4">
          {items.map(({ quote, image }) => (
            <li
              key={quote.id}
              className="flex flex-col gap-4 rounded-2xl border border-stone-800 bg-stone-900/40 p-4 sm:flex-row sm:items-start"
            >
              {image ? (
                <img
                  src={image.thumbUrl}
                  alt={image.alt}
                  className="h-24 w-full rounded-xl object-cover sm:h-24 sm:w-32"
                />
              ) : null}

              <div className="min-w-0 flex-1">
                <Link
                  to="/q/$id"
                  params={{ id: quote.id }}
                  className="font-serif text-lg leading-snug text-stone-100 transition hover:text-amber-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300"
                >
                  {quote.text}
                </Link>
                <p className="mt-2 text-sm text-stone-400">
                  {quote.author}, {quote.work}
                </p>
                {image ? <PhotoCredit image={image} className="mt-2" /> : null}
                {removeErrorId === quote.id ? (
                  <p className="mt-2 text-xs text-amber-200" role="alert">
                    Could not remove this quote.
                  </p>
                ) : null}
              </div>

              <button
                type="button"
                onClick={() => handleRemove(quote.id)}
                disabled={removingId === quote.id}
                aria-label={`Remove quote by ${quote.author} from favourites`}
                className="self-start rounded-full border border-stone-700 px-3 py-1.5 text-xs text-stone-300 transition hover:border-amber-300/50 hover:text-amber-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {removingId === quote.id ? 'Removing…' : 'Remove'}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
