import { useEffect, useState } from 'react'
import { useServerFn } from '@tanstack/react-start'

import {
  addFavourite,
  getExplanation,
  getFavourites,
  getImage,
  getRandomQuote,
  removeFavourite,
} from '#/lib/functions'
import type { Explanation, Quote, QuoteImage } from '#/lib/types'
import { useVisitorId } from '#/lib/visitor'

export function withUtm(url: string) {
  const separator = url.includes('?') ? '&' : '?'
  return `${url}${separator}utm_source=stoic-quote&utm_medium=referral`
}

export function PhotoCredit({
  image,
  className = '',
}: {
  image: QuoteImage
  className?: string
}) {
  const linkClass =
    'underline decoration-stone-100/40 underline-offset-2 transition hover:text-stone-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300'

  return (
    <p
      className={`[text-shadow:0_1px_2px_rgba(0,0,0,0.85)] text-[11px] leading-tight text-stone-100/80 ${className}`}
    >
      Photo by{' '}
      <a
        href={withUtm(image.photographer.profileUrl)}
        target="_blank"
        rel="noopener noreferrer"
        className={linkClass}
      >
        {image.photographer.name}
      </a>{' '}
      on{' '}
      <a
        href={withUtm(image.unsplashUrl)}
        target="_blank"
        rel="noopener noreferrer"
        className={linkClass}
      >
        Unsplash
      </a>
    </p>
  )
}

const actionButtonClass =
  'inline-flex items-center gap-2 rounded-full border border-stone-100/20 bg-stone-950/50 px-4 py-2 text-sm font-medium text-stone-100 backdrop-blur transition hover:border-amber-300/50 hover:bg-stone-950/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300 disabled:cursor-not-allowed disabled:opacity-60'

function attributionFor(quote: Quote) {
  return [quote.author, quote.work, quote.section]
    .filter((part): part is string => Boolean(part))
    .join(', ')
}

type QuoteExperienceProps = {
  initialQuote: Quote
  initialImage: QuoteImage | null
  canExplain: boolean
  enableRandom?: boolean
}

export function QuoteExperience({
  initialQuote,
  initialImage,
  canExplain,
  enableRandom = false,
}: QuoteExperienceProps) {
  const [quote, setQuote] = useState(initialQuote)
  const [image, setImage] = useState<QuoteImage | null>(initialImage)
  const [explanation, setExplanation] = useState<Explanation | null>(null)
  const [showExplanation, setShowExplanation] = useState(false)
  const [isExplaining, setIsExplaining] = useState(false)
  const [favouriteIds, setFavouriteIds] = useState<Set<string>>(new Set())
  const [isSaving, setIsSaving] = useState(false)
  const [isLoadingQuote, setIsLoadingQuote] = useState(false)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const visitorId = useVisitorId()
  const fetchRandomQuote = useServerFn(getRandomQuote)
  const fetchImage = useServerFn(getImage)
  const fetchExplanation = useServerFn(getExplanation)
  const fetchFavourites = useServerFn(getFavourites)
  const saveFavourite = useServerFn(addFavourite)
  const deleteFavourite = useServerFn(removeFavourite)

  useEffect(() => {
    if (!visitorId) return

    let cancelled = false
    fetchFavourites({ data: { visitorId } })
      .then((result) => {
        if (!cancelled && result) setFavouriteIds(new Set(result.ids))
      })
      .catch(() => {
        if (!cancelled) setError('Could not load your saved quotes.')
      })

    return () => {
      cancelled = true
    }
  }, [visitorId, fetchFavourites])

  const isFavourite = favouriteIds.has(quote.id)

  async function handleNewQuote() {
    if (isLoadingQuote) return

    setIsLoadingQuote(true)
    setError(null)

    try {
      const next = await fetchRandomQuote({ data: {} })
      if (!next) throw new Error('The quote API returned no quote')

      let nextImage: QuoteImage | null = null
      try {
        nextImage = await fetchImage({ data: { id: next.id } })
      } catch {
        nextImage = null
      }

      setQuote(next)
      setImage(nextImage)
      setExplanation(null)
      setShowExplanation(false)
      setCopied(false)
    } catch {
      setError('Could not load a new quote. Please try again.')
    } finally {
      setIsLoadingQuote(false)
    }
  }

  async function handleExplain() {
    if (isExplaining) return

    if (explanation) {
      setShowExplanation((visible) => !visible)
      return
    }

    setIsExplaining(true)
    setError(null)

    try {
      const result = await fetchExplanation({ data: { id: quote.id } })
      if (!result) {
        setError('No explanation is available for this quote yet.')
        return
      }

      setExplanation(result)
      setShowExplanation(true)
    } catch {
      setError('No explanation is available for this quote yet.')
    } finally {
      setIsExplaining(false)
    }
  }

  async function handleToggleFavourite() {
    if (!visitorId || isSaving) return

    const quoteId = quote.id
    const shouldSave = !isFavourite
    setIsSaving(true)
    setError(null)
    setFavouriteIds((previous) => {
      const next = new Set(previous)
      if (shouldSave) next.add(quoteId)
      else next.delete(quoteId)
      return next
    })

    try {
      if (shouldSave) {
        await saveFavourite({ data: { visitorId, quoteId } })
      } else {
        await deleteFavourite({ data: { visitorId, quoteId } })
      }
    } catch {
      setFavouriteIds((previous) => {
        const next = new Set(previous)
        if (shouldSave) next.delete(quoteId)
        else next.add(quoteId)
        return next
      })
      setError('Could not update your saved quotes.')
    } finally {
      setIsSaving(false)
    }
  }

  async function handleShare() {
    const url = `${window.location.origin}/q/${quote.id}`
    setError(null)

    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({
          title: 'Stoic Quote',
          text: `${quote.text} — ${quote.author}`,
          url,
        })
        return
      } catch (shareError) {
        if (shareError instanceof DOMException && shareError.name === 'AbortError') {
          return
        }
      }
    }

    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      setError('Could not copy the link.')
    }
  }

  return (
    <section
      className="relative flex min-h-[calc(100svh-3.5rem)] flex-col justify-end overflow-hidden"
      style={{ backgroundColor: image?.color ?? '#1c1917' }}
    >
      {image ? (
        <img
          src={image.url}
          alt={image.alt}
          className="absolute inset-0 h-full w-full object-cover"
          fetchPriority="high"
        />
      ) : null}
      <div
        className="absolute inset-0 bg-gradient-to-t from-stone-950/95 via-stone-950/60 to-stone-950/30"
        aria-hidden="true"
      />

      {image ? (
        <PhotoCredit image={image} className="absolute bottom-3 right-3 z-20" />
      ) : null}

      <div className="relative z-10 mx-auto w-full max-w-4xl px-6 pb-16 pt-28 sm:px-10 sm:pb-20">
        <blockquote>
          <p className="font-serif text-3xl leading-snug text-stone-50 sm:text-4xl md:text-5xl">
            {quote.text}
          </p>
          <footer className="mt-6 text-sm text-stone-300 sm:text-base">
            <cite className="not-italic">{attributionFor(quote)}</cite>
          </footer>
        </blockquote>

        <div className="mt-8 flex flex-wrap items-center gap-3">
          {enableRandom ? (
            <button
              type="button"
              onClick={handleNewQuote}
              disabled={isLoadingQuote}
              aria-label="Show a new random quote"
              className={actionButtonClass}
            >
              <RefreshIcon />
              {isLoadingQuote ? 'Loading…' : 'New quote'}
            </button>
          ) : null}

          {canExplain ? (
            <button
              type="button"
              onClick={handleExplain}
              disabled={isExplaining}
              aria-expanded={showExplanation}
              aria-label="Explain this quote"
              className={actionButtonClass}
            >
              <SparkIcon />
              {isExplaining ? 'Explaining…' : showExplanation ? 'Hide explanation' : 'Explain'}
            </button>
          ) : null}

          <button
            type="button"
            onClick={handleToggleFavourite}
            disabled={!visitorId || isSaving}
            aria-pressed={isFavourite}
            aria-label={isFavourite ? 'Remove from favourites' : 'Save to favourites'}
            className={actionButtonClass}
          >
            <HeartIcon filled={isFavourite} />
            {isFavourite ? 'Saved' : 'Save'}
          </button>

          <button
            type="button"
            onClick={handleShare}
            aria-label="Share this quote"
            className={actionButtonClass}
          >
            <ShareIcon />
            {copied ? 'Link copied' : 'Share'}
          </button>
        </div>

        {error ? (
          <p role="alert" className="mt-4 text-sm text-amber-200">
            {error}
          </p>
        ) : null}

        {showExplanation && explanation ? (
          <div className="mt-6 max-w-2xl rounded-2xl border border-stone-100/15 bg-stone-950/70 p-5 backdrop-blur">
            <p className="font-serif text-base leading-relaxed text-stone-100">
              {explanation.text}
            </p>
            <p className="mt-3 text-xs tracking-wide text-amber-300/80 uppercase">
              Generated by DeepSeek
            </p>
          </div>
        ) : null}
      </div>
    </section>
  )
}

function RefreshIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      aria-hidden="true"
    >
      <path d="M20 11a8 8 0 1 0-2.3 5.7" strokeLinecap="round" />
      <path d="M20 5v6h-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function SparkIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      aria-hidden="true"
    >
      <path
        d="M12 3v4m0 10v4m-7-9h4m6 0h4m-2.5-5.5-2.8 2.8M7.3 16.7l2.8-2.8m0 0-2.8-2.8m9.4-9.4-2.8 2.8"
        strokeLinecap="round"
      />
    </svg>
  )
}

function HeartIcon({ filled }: { filled: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth={1.7}
      aria-hidden="true"
    >
      <path
        d="M12 20.5 4.4 13a4.8 4.8 0 0 1 6.8-6.8l.8.8.8-.8A4.8 4.8 0 0 1 19.6 13Z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function ShareIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      aria-hidden="true"
    >
      <path d="M12 3v12" strokeLinecap="round" />
      <path d="m7.5 7.5 4.5-4.5 4.5 4.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" strokeLinecap="round" />
    </svg>
  )
}
