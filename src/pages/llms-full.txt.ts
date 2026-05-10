import type { APIRoute } from "astro";
import { getCollection, type CollectionEntry } from "astro:content";

function blockFor(b: CollectionEntry<"books">): string {
  const d = b.data;
  const lines = [
    `## ${d.title}`,
    `- Author: ${d.author}`,
  ];
  if (d.series) lines.push(`- Series: ${d.series.name} #${d.series.position}`);
  if (d.isbn) lines.push(`- ISBN: ${d.isbn}`);
  lines.push(`- Status: ${d.status}`);
  if (d.rating !== null) lines.push(`- Rating: ${d.rating}/5`);
  if (d.date_started) lines.push(`- Started: ${d.date_started}`);
  if (d.date_finished) lines.push(`- Finished: ${d.date_finished}`);
  if (d.tags.length) lines.push(`- Tags: ${d.tags.join(", ")}`);
  if (d.cover_url) lines.push(`- Cover: ${d.cover_url}`);
  lines.push(`- ID: ${d.id}`);
  return lines.join("\n");
}

function byTitle(a: CollectionEntry<"books">, b: CollectionEntry<"books">): number {
  return a.data.title.localeCompare(b.data.title);
}

export const GET: APIRoute = async () => {
  const all = await getCollection("books");
  const read = all.filter((b) => b.data.status === "read").sort(byTitle);
  const generated = new Date().toISOString().slice(0, 10);

  const header = [
    `# Nick's Library — full read list`,
    ``,
    `> ${read.length} books with status = "read", sorted by title.`,
    `> Generated ${generated} from books.json.`,
  ].join("\n");

  const body = [header, ...read.map(blockFor)].join("\n\n") + "\n";

  return new Response(body, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
};
