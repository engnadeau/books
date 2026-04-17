import { defineCollection, z } from "astro:content";
import { file } from "astro/loaders";

const books = defineCollection({
  loader: file("books.json"),
  schema: z.object({
    id: z.string(),
    title: z.string(),
    author: z.string(),
    series: z
      .object({
        name: z.string(),
        position: z.number(),
      })
      .nullable(),
    isbn: z.string().nullable(),
    cover_url: z.string().nullable(),
    status: z.enum(["read", "reading", "to-read", "dnf"]),
    rating: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]).nullable(),
    date_started: z.string().nullable(),
    date_finished: z.string().nullable(),
    tags: z.array(z.string()),
  }),
});

export const collections = { books };
