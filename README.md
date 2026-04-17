# books

A self-hosted, version-controlled replacement for Goodreads. Books live as a
single JSON file in git; an Astro static site renders the ones I've read.

- **Live site:** https://engnadeau.github.io/books/
- **Canonical data (for LLMs / external tools):**
  https://raw.githubusercontent.com/engnadeau/books/main/books.json

## Why

Goodreads' data model is noisy and its export format is hostile. A flat JSON
file in a public git repo is easier to edit, easier to fetch, and trivial for
a language-model agent to reason over via the raw GitHub URL.

## Local development

```sh
pnpm install
pnpm dev
```

Open http://localhost:4321.

## Scripts

```sh
# One-shot seed: turn a Goodreads CSV export into books.json.
# Refuses to overwrite an existing books.json unless --force is passed.
pnpm import "/path/to/goodreads_library_export.csv"

# Fetch cover URLs from Open Library. Tries ISBN lookup first,
# falls back to title+author search. Writes URLs to each book's cover_url field.
# --only-read limits to read books; --force re-fetches books that already have covers.
pnpm covers --only-read

# Build/preview.
pnpm build
pnpm preview
```

## Schema

`books.json` is a JSON array of:

```ts
{
  id: string;                           // stable slug, never regenerated
  title: string;
  author: string;
  series: { name: string; position: number } | null;
  isbn: string | null;                  // ISBN13 preferred, else ISBN10
  cover_url: string | null;             // Open Library URL, populated by pnpm covers
  status: "read" | "reading" | "to-read" | "dnf";
  rating: 1 | 2 | 3 | 4 | 5 | null;
  date_started: string | null;          // YYYY-MM-DD
  date_finished: string | null;         // YYYY-MM-DD
  tags: string[];                       // lowercase kebab-case
}
```

The Zod schema in `src/content.config.ts` validates this on every `astro sync`
and build, so malformed entries fail loudly instead of silently breaking the
site.

## Deployment

GitHub Pages via `.github/workflows/deploy.yml`. Every push to `main` rebuilds
and redeploys. The workflow uses `withastro/action@v6`, which auto-detects
pnpm from the lockfile.

## Project layout

```
books.json                      source of truth
src/content.config.ts           Zod schema + file loader
src/pages/index.astro           only page; filters to status === "read"
src/components/BookTable.astro  cover grid + client-side search/sort
src/styles/global.css
scripts/import-goodreads.ts     CSV → books.json
scripts/fetch-covers.ts         books.json → books.json (with cover_url)
docs/superpowers/specs/         design docs
```

## Design intent

- `id` is immutable once created. Everything else can be hand-edited.
- `books.json` is written with `JSON.stringify(x, null, 2) + "\n"` so git
  diffs stay clean.
- A future MCP server will read and write `books.json` directly — no new
  schema, no transformation layer.
