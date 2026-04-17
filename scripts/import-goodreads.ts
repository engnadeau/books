import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { parse } from "csv-parse/sync";

type Status = "read" | "reading" | "to-read" | "dnf";

type Book = {
  id: string;
  title: string;
  author: string;
  series: { name: string; position: number } | null;
  isbn: string | null;
  cover_url: string | null;
  status: Status;
  rating: 1 | 2 | 3 | 4 | 5 | null;
  date_started: string | null;
  date_finished: string | null;
  tags: string[];
};

const SERIES_RE = /^(.+?)\s*\((.+?),?\s*#(\d+(?:\.\d+)?)\)\s*$/;

function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function lastNameOf(author: string): string {
  const cleaned = author.trim().replace(/\s+/g, " ");
  const parts = cleaned.split(" ");
  return parts[parts.length - 1] ?? cleaned;
}

function parseTitleAndSeries(raw: string): {
  title: string;
  series: Book["series"];
} {
  const match = raw.match(SERIES_RE);
  if (!match) return { title: raw.trim(), series: null };
  const [, title, seriesName, position] = match;
  return {
    title: title.trim(),
    series: { name: seriesName.trim(), position: Number(position) },
  };
}

function mapStatus(exclusiveShelf: string): Status {
  switch (exclusiveShelf) {
    case "read":
      return "read";
    case "to-read":
      return "to-read";
    case "currently-reading":
      return "reading";
    default:
      throw new Error(
        `Unexpected Exclusive Shelf value: "${exclusiveShelf}". ` +
          `Expected one of: read, to-read, currently-reading.`,
      );
  }
}

function mapRating(raw: string): Book["rating"] {
  const n = Number(raw);
  if (n === 0) return null;
  if (n >= 1 && n <= 5 && Number.isInteger(n)) return n as 1 | 2 | 3 | 4 | 5;
  throw new Error(`Unexpected My Rating value: "${raw}"`);
}

function mapIsbn(isbn13: string, isbn10: string): string | null {
  const strip = (s: string) => s.replace(/^="?|"?$/g, "").trim();
  const clean13 = strip(isbn13);
  const clean10 = strip(isbn10);
  return clean13 || clean10 || null;
}

function mapDate(raw: string): string | null {
  if (!raw) return null;
  const match = raw.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
  if (!match) throw new Error(`Unexpected date value: "${raw}"`);
  const [, y, m, d] = match;
  return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
}

function generateIds(books: Omit<Book, "id">[]): Book[] {
  const counts = new Map<string, number>();
  return books.map((book) => {
    const base = `${slugify(book.title)}-${slugify(lastNameOf(book.author))}`;
    const count = counts.get(base) ?? 0;
    counts.set(base, count + 1);
    const id = count === 0 ? base : `${base}-${count + 1}`;
    return { id, ...book };
  });
}

function main() {
  const args = process.argv.slice(2);
  const force = args.includes("--force");
  const positional = args.filter((a) => !a.startsWith("--"));

  if (positional.length !== 1) {
    console.error("Usage: pnpm import <path-to-goodreads-csv> [--force]");
    process.exit(1);
  }

  const csvPath = positional[0];
  const outPath = resolve(process.cwd(), "books.json");

  if (existsSync(outPath) && !force) {
    console.error(
      `Refusing to overwrite existing books.json. Pass --force to override.`,
    );
    process.exit(1);
  }

  const raw = readFileSync(csvPath, "utf8");
  const rows = parse(raw, {
    columns: true,
    skip_empty_lines: true,
  }) as Record<string, string>[];

  const mapped: Omit<Book, "id">[] = rows.map((row) => {
    const { title, series } = parseTitleAndSeries(row["Title"] ?? "");
    return {
      title,
      author: (row["Author"] ?? "").trim(),
      series,
      isbn: mapIsbn(row["ISBN13"] ?? "", row["ISBN"] ?? ""),
      cover_url: null,
      status: mapStatus(row["Exclusive Shelf"] ?? ""),
      rating: mapRating(row["My Rating"] ?? "0"),
      date_started: null,
      date_finished: mapDate(row["Date Read"] ?? ""),
      tags: [],
    };
  });

  const books = generateIds(mapped);
  writeFileSync(outPath, JSON.stringify(books, null, 2) + "\n", "utf8");
  console.log(`Wrote ${books.length} books to ${outPath}`);
}

main();
