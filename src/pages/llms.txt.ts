import type { APIRoute } from "astro";
import { getCollection, type CollectionEntry } from "astro:content";

const SITE = "https://engnadeau.github.io/books";
const REPO = "https://github.com/engnadeau/books";
const RAW_JSON = "https://raw.githubusercontent.com/engnadeau/books/main/books.json";

function rowFor(b: CollectionEntry<"books">): string {
  const d = b.data;
  const series = d.series ? ` (${d.series.name} #${d.series.position})` : "";
  const rating = d.rating ? ` — ${d.rating}/5` : "";
  const year = d.date_finished ? ` — ${d.date_finished.slice(0, 4)}` : "";
  const tags = d.tags.length ? ` — ${d.tags.join(", ")}` : "";
  return `- ${d.title} — ${d.author}${series}${rating}${year}${tags}`;
}

function byTitle(a: CollectionEntry<"books">, b: CollectionEntry<"books">): number {
  return a.data.title.localeCompare(b.data.title);
}

export const GET: APIRoute = async () => {
  const all = await getCollection("books");
  const read = all.filter((b) => b.data.status === "read").sort(byTitle);

  const body = [
    `# Nick's Library`,
    ``,
    `> Personal reading log. Source of truth is books.json in git.`,
    `> This file lists books with status = "read", sorted by title.`,
    ``,
    `## Canonical sources`,
    `- [books.json](${RAW_JSON}): full data for all statuses (read, reading, to-read, dnf)`,
    `- [llms-full.txt](${SITE}/llms-full.txt): every read book as markdown with all fields`,
    `- [Site](${SITE}/): rendered grid with search and sort`,
    `- [Repository](${REPO}): schema, scripts, license`,
    ``,
    `## Schema`,
    `Each entry in books.json has: id (immutable slug), title, author,`,
    `series { name, position } | null, isbn, cover_url, status`,
    `("read" | "reading" | "to-read" | "dnf"), rating (1–5 | null),`,
    `date_started, date_finished (YYYY-MM-DD | null), tags (lowercase kebab-case).`,
    ``,
    `## Read books (${read.length})`,
    ...read.map(rowFor),
    ``,
  ].join("\n");

  return new Response(body, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
};
