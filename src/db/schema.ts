import { pgTable, text, timestamp, integer, real, boolean, jsonb, varchar, uuid } from "drizzle-orm/pg-core";

export const mediaItems = pgTable("media_items", {
  id: uuid("id").defaultRandom().primaryKey(),
  title: varchar("title", { length: 255 }).notNull(),
  category: varchar("category", { length: 50 }).notNull(), // movie | series | manhwa | anime | book | cartoon | drama
  coverImage: text("cover_image").notNull(),
  description: text("description").notNull().default(""),
  genres: jsonb("genres").$type<string[]>().notNull().default([]),
  rating: real("rating").notNull().default(0),
  recommended: boolean("recommended").notNull().default(false),
  
  // Progress fields - stored as JSON for flexibility across categories
  progress: jsonb("progress").$type<{
    currentChapter?: number;
    totalChapters?: number;
    currentEpisode?: number;
    totalEpisodes?: number;
    currentSeason?: number;
    totalSeasons?: number;
    seasons?: Array<{ seasonNumber: number; totalEpisodes: number }>;
    currentPage?: number;
    totalPages?: number;
    watched?: boolean;
    watchPercentage?: number;
  }>().notNull().default({}),

  // Optional owner for multi-user support
  owner: varchar("owner", { length: 255 }),

  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export type MediaItem = typeof mediaItems.$inferSelect;
export type NewMediaItem = typeof mediaItems.$inferInsert;

// Links table for prequel/sequel relationships
export const mediaLinks = pgTable("media_links", {
  id: uuid("id").defaultRandom().primaryKey(),
  sourceId: uuid("source_id")
    .notNull()
    .references(() => mediaItems.id, { onDelete: "cascade" }),
  targetId: uuid("target_id")
    .notNull()
    .references(() => mediaItems.id, { onDelete: "cascade" }),
  linkType: varchar("link_type", { length: 20 }).notNull(), // "prequel" | "sequel"
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export type MediaLink = typeof mediaLinks.$inferSelect;
export type NewMediaLink = typeof mediaLinks.$inferInsert;
