import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

type Book = {
  id: string;
  title: string;
  author: string;
  isbn: string | null;
  cover_url: string | null;
  status: string;
  [key: string]: unknown;
};

const OL_COVER_BY_ISBN = (isbn: string, size: "S" | "M" | "L") =>
  `https://covers.openlibrary.org/b/isbn/${isbn}-${size}.jpg?default=false`;

const OL_COVER_BY_ID = (id: number, size: "S" | "M" | "L") =>
  `https://covers.openlibrary.org/b/id/${id}-${size}.jpg`;

const OL_SEARCH = (title: string, author: string) =>
  `https://openlibrary.org/search.json?title=${encodeURIComponent(title)}&author=${encodeURIComponent(author)}&fields=cover_i,title,author_name&limit=1`;

type SearchResponse = {
  docs: Array<{ cover_i?: number; title?: string; author_name?: string[] }>;
};

async function headOk(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, { method: "HEAD" });
    return res.ok;
  } catch {
    return false;
  }
}

async function coverFromIsbn(isbn: string): Promise<string | null> {
  const url = OL_COVER_BY_ISBN(isbn, "M");
  return (await headOk(url)) ? url : null;
}

async function coverFromSearch(
  title: string,
  author: string,
): Promise<string | null> {
  try {
    const res = await fetch(OL_SEARCH(title, author));
    if (!res.ok) return null;
    const data = (await res.json()) as SearchResponse;
    const cover = data.docs[0]?.cover_i;
    return cover ? OL_COVER_BY_ID(cover, "M") : null;
  } catch {
    return null;
  }
}

async function findCover(book: Book): Promise<string | null> {
  if (book.isbn) {
    const fromIsbn = await coverFromIsbn(book.isbn);
    if (fromIsbn) return fromIsbn;
  }
  return coverFromSearch(book.title, book.author);
}

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  const force = process.argv.includes("--force");
  const onlyRead = process.argv.includes("--only-read");
  const path = resolve(process.cwd(), "books.json");
  const books = JSON.parse(readFileSync(path, "utf8")) as Book[];

  let updated = 0;
  let skipped = 0;
  let failed = 0;

  for (let i = 0; i < books.length; i++) {
    const book = books[i];
    if (onlyRead && book.status !== "read") {
      skipped++;
      continue;
    }
    if (book.cover_url && !force) {
      skipped++;
      continue;
    }
    process.stdout.write(
      `[${i + 1}/${books.length}] ${book.title} — ${book.author} ... `,
    );
    const url = await findCover(book);
    if (url) {
      book.cover_url = url;
      updated++;
      process.stdout.write("ok\n");
    } else {
      failed++;
      process.stdout.write("none\n");
    }
    // Write after each successful fetch so partial progress is saved.
    writeFileSync(path, JSON.stringify(books, null, 2) + "\n", "utf8");
    await sleep(100);
  }

  console.log(
    `\nDone. Updated: ${updated}, skipped: ${skipped}, failed: ${failed}`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
