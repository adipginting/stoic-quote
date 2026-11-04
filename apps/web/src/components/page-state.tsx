import { Link } from '@tanstack/react-router'

type PageStateProps = {
  title: string
  message: string
}

function PageState({ title, message }: PageStateProps) {
  return (
    <div className="mx-auto flex min-h-[60svh] w-full max-w-xl flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="font-serif text-3xl text-stone-50">{title}</h1>
      <p className="text-sm text-stone-300">{message}</p>
      <Link
        to="/"
        className="rounded-full border border-amber-300/40 bg-amber-300/10 px-4 py-2 text-sm text-amber-200 transition hover:bg-amber-300/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300"
      >
        Back to today&apos;s quote
      </Link>
    </div>
  )
}

export function ErrorState({ title, message }: PageStateProps) {
  return <PageState title={title} message={message} />
}

export function NotFoundState({ title, message }: PageStateProps) {
  return <PageState title={title} message={message} />
}
