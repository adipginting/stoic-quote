import { HeadContent, Link, Scripts, createRootRoute } from '@tanstack/react-router'
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools'
import { TanStackDevtools } from '@tanstack/react-devtools'

import appCss from '../styles.css?url'

export const Route = createRootRoute({
  head: () => ({
    meta: [
      {
        charSet: 'utf-8',
      },
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1',
      },
      {
        title: 'Stoic Quote',
      },
      {
        name: 'description',
        content: 'A daily quote from the Stoic classics, with sources and context.',
      },
    ],
    links: [
      {
        rel: 'stylesheet',
        href: appCss,
      },
    ],
  }),
  shellComponent: RootDocument,
})

const navLinkClass =
  'rounded-full px-3 py-1.5 text-sm text-stone-300 transition hover:bg-stone-800 hover:text-stone-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300'

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body className="bg-stone-950 font-sans text-stone-100 antialiased">
        <div className="flex min-h-svh flex-col">
          <header className="sticky top-0 z-30 border-b border-stone-800/80 bg-stone-950/85 backdrop-blur">
            <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
              <Link
                to="/"
                className="font-serif text-lg tracking-wide text-stone-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300"
              >
                Stoic Quote
              </Link>
              <nav aria-label="Main">
                <Link to="/favourites" className={navLinkClass}>
                  Favourites
                </Link>
              </nav>
            </div>
          </header>

          <main className="flex-1">{children}</main>

          <footer className="border-t border-stone-800/80 bg-stone-950 px-4 py-4 text-center text-xs text-stone-500 sm:px-6">
            <p>
              All texts are public domain (George Long / Aubrey Stewart translations,
              Standard Ebooks sources). Photos come from Unsplash.
            </p>
          </footer>
        </div>

        <TanStackDevtools
          config={{
            position: 'bottom-right',
          }}
          plugins={[
            {
              name: 'Tanstack Router',
              render: <TanStackRouterDevtoolsPanel />,
            },
          ]}
        />
        <Scripts />
      </body>
    </html>
  )
}
