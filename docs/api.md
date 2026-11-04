# API reference

Base URL: the API listens on `PORT` (default `3000`). Interactive docs are
served at **`/api-doc`** (Swagger). All v2 responses are JSON; there is no
authentication except the `x-visitor-id` header on favourites.

Errors use Nest's default shape, and `message` may be a string or an object:

```json
{ "statusCode": 404, "message": "Quote not found", "error": "Not Found" }
```

## Objects

`Quote`

```json
{
  "id": "discourses-1-10-1",
  "text": "This it is to have studied what a man ought to study; to have made desire, aversion, free from hindrance, and free from all that a man would avoid.",
  "author": "Epictetus",
  "work": "Discourses",
  "section": "Book 1",
  "translation": "George Long",
  "tags": ["freedom", "desire", "duty"]
}
```

`Meta`

```json
{
  "name": "Stoic Quote API",
  "version": "0.0.1",
  "quoteCount": 7928,
  "capabilities": { "explain": true, "images": false },
  "works": ["discourses", "enchiridion", "meditations", "seneca"]
}
```

`Explanation`

```json
{ "quoteId": "…", "model": "deepseek-flash", "promptVersion": 1, "text": "…", "createdAt": "2026-01-01T00:00:00.000Z", "cached": false }
```

`Image`

```json
{
  "quoteId": "…",
  "query": "wide open meadow under blue sky",
  "url": "https://images.unsplash.com/…&w=1600&q=80",
  "thumbUrl": "https://images.unsplash.com/…&w=480&q=80",
  "ogUrl": "https://images.unsplash.com/…&fit=crop&w=1200&h=630&q=80",
  "color": "#60544D",
  "alt": "green grass field under blue sky",
  "photographer": { "name": "…", "username": "…", "profileUrl": "https://unsplash.com/@…" },
  "unsplashUrl": "https://unsplash.com/photos/…"
}
```

## Endpoints

### `GET /health`

`200 { "status": "ok" }`. Used by the k3s probes.

### `GET /v2/meta`

Counts, work slugs, and which optional features are configured
(`capabilities.explain` / `capabilities.images`). The web app hides those
actions when the matching capability is `false`.

### `GET /v2/quotes/random`

| Query | Type | Notes |
| --- | --- | --- |
| `tag` | string | one of the tag vocabulary |
| `work` | string | a work slug from `/v2/meta` |
| `minLength` | number | characters |
| `maxLength` | number | characters |

```bash
curl 'http://localhost:3000/v2/quotes/random?work=meditations&minLength=150'
```

`404` if no quote matches.

### `GET /v2/quotes/daily`

`?date=YYYY-MM-DD` (defaults to today, UTC). Deterministic: the same date always
returns the same quote (FNV-1a hash → index). `400` on an invalid date.

### `GET /v2/quotes/:id`

One quote. `404` if unknown.

### `GET /v2/quotes/:id/explanation`

Generates a 2–3 sentence explanation with DeepSeek and caches it by
`(quote_id, model, promptVersion)`.

- `200` with `cached: true` on repeat calls.
- `404` if the quote is unknown.
- `503` if `DEEPSEEK_API_KEY` is not configured.

### `GET /v2/quotes/:id/image`

Searches Unsplash for the quote's first tag and caches the chosen photo.

- `404` with `message.reason = "not_configured"` when
  `UNSPLASH_ACCESS_KEY` is unset, or `"no_result"` when the search is empty.
- `503` when Unsplash itself fails.

Images must be hotlinked from `url`/`thumbUrl`/`ogUrl` and credited to the
returned photographer (Unsplash API guideline).

### `GET | POST | DELETE /v2/favourites`

Requires `x-visitor-id`, 8–64 chars of `[A-Za-z0-9_-]` (the browser generates a
UUID). `400` otherwise.

```bash
curl 'http://localhost:3000/v2/favourites' -H 'x-visitor-id: 6f1e…'
curl -X POST 'http://localhost:3000/v2/favourites' \
  -H 'content-type: application/json' -H 'x-visitor-id: 6f1e…' \
  -d '{"quoteId":"…"}'
curl -X DELETE 'http://localhost:3000/v2/favourites/…' -H 'x-visitor-id: 6f1e…'
```

`GET` returns `{ ids: string[], quotes: Quote[] }` (newest first). `POST`
returns `{ quoteId }` (`404` if the quote is unknown) and is idempotent. `DELETE`
returns `204`.

## v1 (frozen)

Plain-text endpoints kept byte-compatible for existing consumers:
`GET /`, `/aurelius`, `/seneca`, `/epictetus-theenchiridion`,
`/epictetus-discourses`. `/` accepts `min`/`max` and preserves the original
`> 100` validation (`400`) and "no quote" behaviour (`417`). New integrations
should use `/v2/*`.
