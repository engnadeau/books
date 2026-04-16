# Books Library Site — Design

**Date:** 2026-04-16
**Status:** Approved for implementation

## Goal

Replace Goodreads with a self-hosted, version-controlled reading library that:

1. Stores book data as a single canonical JSON file in git, fetchable by any LLM from `raw.githubusercontent.com`.
2. Renders a browseable Astro static site from that JSON (`pnpm dev` works locally).
3. Is designed so a future MCP server can read and write the JSON through git without reshaping the schema.

The v1 deliverable is the data layer + static site. The MCP server is an explicit follow-up; v1 must not paint it into a corner.

## Non-goals (v1)

- Per-book pages, per-tag indexes, per-series indexes
- Cover images, ISBN lookup, Open Library enrichment
- Long-form review bodies (markdown per book)
- The MCP server itself
- Recommendation engine or stats dashboards
- GitHub Pages deploy workflow (dev-mode only is fine for v1)

## Repo structure

```
books/
├── books.json                         # source of truth (committed)
├── package.json                       # pnpm + astro
├── astro.config.mjs
├── pnpm-lock.yaml
├── tsconfig.json
├── src/
│   ├── content.config.ts              # Astro content collection loading books.json
│   ├── pages/
│   │   └── index.astro                # the library list (only page in v1)
│   ├── components/
│   │   └── BookTable.astro            # renders the sortable/filterable table
│   └── styles/
│       └── global.css
├── scripts/
│   └── import-goodreads.ts            # one-shot CSV → books.json
├── docs/superpowers/specs/            # this document
└── README.md
```

`books.json` lives at the repo root (not under `src/`) so the canonical fetch URL is `https://raw.githubusercontent.com/<user>/books/main/books.json`.

## Schema

`books.json` is a JSON array of book objects. Shape:

```ts
type Status = "read" | "reading" | "to-read" | "dnf";

type Book = {
  id: string;                          // unique, stable slug; e.g. "blindsight-watts"
  title: string;
  author: string;
  series: { name: string; position: number } | null;
  status: Status;
  rating: 1 | 2 | 3 | 4 | 5 | null;    // null = unrated
  date_started: string | null;         // ISO date (YYYY-MM-DD)
  date_finished: string | null;        // ISO date (YYYY-MM-DD)
  tags: string[];                      // lowercase kebab-case; may be empty
};
```

**Field rules:**

- `id` is required and must be unique across the array. Convention: slugify(title) + `-` + slugify(lastname). Collisions get a numeric suffix (`-2`, `-3`).
- `title`, `author`, `status` are required strings/enum.
- `rating` is an integer 1-5 or `null`. No zero.
- `series` is an object or `null`. Standalone books are `null`, not an empty object.
- Dates are ISO strings or `null`. Both may be `null` for to-read.
- `tags` is always an array (may be empty). Strings are lowercase kebab-case.

Validation via Zod in `src/content.config.ts`. Build-time failure on any malformed entry.

## Goodreads import

`scripts/import-goodreads.ts`, invoked as:

```
pnpm import "/absolute/path/to/goodreads_library_export.csv"
```

The Goodreads CSV is not committed to the repo — it lives in the user's Google Drive and is treated as disposable source material.

**Mapping:**

| Goodreads column      | `Book` field                                                   |
| --------------------- | -------------------------------------------------------------- |
| `Title`               | `title` (series suffix stripped — see parsing below)           |
| `Author`              | `author`                                                       |
| `My Rating`           | `rating` (0 → `null`)                                          |
| `Exclusive Shelf`     | `status` (`read`, `to-read`, `currently-reading` → `reading`)  |
| `Date Read`           | `date_finished` (reformatted `YYYY/MM/DD` → `YYYY-MM-DD`)      |
| —                     | `date_started` always `null` (Goodreads doesn't track it)      |
| —                     | `tags` always `[]` (hand-curated later; Goodreads shelves are noisy) |

Dropped: `Book Id`, `Author l-f`, `Additional Authors`, `ISBN`, `ISBN13`, `Average Rating`, `Publisher`, `Binding`, `Number of Pages`, `Year Published`, `Original Publication Year`, `Date Added`, `Bookshelves`, `Bookshelves with positions`, `My Review`, `Spoiler`, `Private Notes`, `Read Count`, `Owned Copies`.

**Series parsing:** Regex on `Title` field: `/^(.+?)\s*\((.+?),\s*#(\d+(?:\.\d+)?)\)\s*$/`. Group 1 → `title`, group 2 → `series.name`, group 3 → `series.position` as number. No match → `series = null`.

**ID generation:** slugify(title without series suffix) + `-` + slugify(last token of `author`). Collisions resolved by appending `-2`, `-3`, etc.

**Safety:** Script refuses to run if `books.json` already exists unless `--force` is passed. Idempotent with `--force` (same input → same output).

## Site rendering

### `src/content.config.ts`

Defines a single content collection `books` using Astro's `file()` loader pointing at `../books.json`. Exports a Zod schema matching the type above. Astro validates on every dev reload and build.

### `src/pages/index.astro`

Renders `<BookTable>` with the full collection. Page title and minimal header.

### `src/components/BookTable.astro`

Server-renders a `<table>` with columns:

- Title
- Author
- Series (shows `name #position` or blank)
- Rating (shows stars or `—`)
- Status (colored pill)
- Tags (clickable chips)
- Date Finished

Above the table: a status filter (pills `all / read / reading / to-read / dnf`) and a text search input.

**Client-side interactivity (single inline `<script>` block, no framework):**

- Status filter pills toggle row `display` by `data-status` attribute.
- Text input filters rows where title/author/any-tag contains the query (case-insensitive).
- Clicking a tag chip puts that tag text into the search input.
- Clicking a column header sorts rows asc/desc (toggles on repeat click). Visual indicator (▲/▼) on the active column.

No React, Svelte, or other UI framework. The script is ~50 lines of vanilla DOM code. Rationale: the list is small (hundreds of rows), everything fits in one DOM tree, and keeping zero JS dependencies makes the build and future maintenance trivial.

### Styling

One stylesheet (`src/styles/global.css`). System font stack. High-contrast readable palette. Responsive at desktop and mobile. No design-system dependency. Visual polish is a follow-up.

## MCP server — forward compatibility notes

The v1 design must not block the future MCP server. Requirements:

- `id` is the stable key the MCP server will mutate against. It must never be regenerated from title/author after initial creation — once written, `id` is immutable.
- `books.json` must be re-serializable with stable field ordering and newline-terminated, so git diffs stay clean when the MCP server writes to it. Use `JSON.stringify(data, null, 2) + "\n"`.
- The import script's output format is the format the MCP server will read and write. No transformation layer between them.

The MCP server itself is out of scope for v1 but will live in `mcp/` as a separate package when built.

## Success criteria (v1)

- `pnpm install && pnpm dev` starts the Astro dev server and renders the library list from `books.json`.
- `pnpm import <csv-path>` produces a valid `books.json` from the Goodreads export.
- Malformed `books.json` entries cause a build/dev error (not a silent broken page).
- Filter pills, search, column sort, and tag-chip click all work in the browser.
- `books.json` is committed and fetchable as raw GitHub content.

## Open questions

None at spec approval time. Tag taxonomy is intentionally deferred — the user will hand-curate tags on `books.json` after the import lands.
