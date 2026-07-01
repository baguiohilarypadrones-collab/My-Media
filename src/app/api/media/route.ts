import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { mediaItems } from "@/db/schema";
import { eq, desc, and, ilike, or, sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

// GET /api/media?category=anime&search=...&limit=50
export async function GET(request: NextRequest) {
  try {
    if (!db) {
      return NextResponse.json({ error: "Database not configured" }, { status: 503 });
    }

    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category");
    const search = searchParams.get("search")?.trim().toLowerCase();
    const owner = searchParams.get("owner");
    const limit = parseInt(searchParams.get("limit") || "100", 10);
    const sort = searchParams.get("sort") || "updatedAt";
    const order = searchParams.get("order") || "desc";

    const conditions = [];

    if (category && category !== "overall") {
      conditions.push(eq(mediaItems.category, category));
    }

    if (owner) {
      conditions.push(eq(mediaItems.owner, owner));
    }

    if (search) {
      conditions.push(
        or(
          ilike(mediaItems.title, `%${search}%`),
          ilike(mediaItems.description, `%${search}%`)
        )
      );
    }

    const baseQuery = db.select().from(mediaItems).$dynamic();

    const whereQuery = conditions.length > 0
      ? baseQuery.where(conditions.length === 1 ? conditions[0] : and(...conditions))
      : baseQuery;

    // Sorting
    let orderedQuery;
    if (sort === "updatedAt") {
      orderedQuery = order === "desc"
        ? whereQuery.orderBy(desc(mediaItems.updatedAt))
        : whereQuery.orderBy(mediaItems.updatedAt);
    } else if (sort === "rating") {
      orderedQuery = whereQuery.orderBy(desc(mediaItems.rating));
    } else if (sort === "createdAt") {
      orderedQuery = whereQuery.orderBy(desc(mediaItems.createdAt));
    } else {
      orderedQuery = whereQuery.orderBy(desc(mediaItems.updatedAt));
    }

    const results = await orderedQuery.limit(Math.min(limit, 200));

    // Transform to match frontend MediaItem shape
    const transformed = results.map((row) => ({
      _id: row.id,
      title: row.title,
      category: row.category,
      coverImage: row.coverImage,
      description: row.description,
      genres: row.genres || [],
      rating: row.rating,
      recommended: row.recommended,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      progress: row.progress || {},
      owner: row.owner || undefined,
    }));

    return NextResponse.json(transformed);
  } catch (error) {
    console.error("GET /api/media error:", error);
    return NextResponse.json(
      { error: "Failed to fetch media", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

// POST /api/media
export async function POST(request: NextRequest) {
  try {
    if (!db) {
      return NextResponse.json({ error: "Database not configured" }, { status: 503 });
    }

    const body = await request.json();

    const {
      title,
      category,
      coverImage,
      description = "",
      genres = [],
      rating = 0,
      recommended = false,
      progress = {},
      owner = null,
    } = body;

    if (!title || !category || !coverImage) {
      return NextResponse.json(
        { error: "title, category, and coverImage are required" },
        { status: 400 }
      );
    }

    const [inserted] = await db
      .insert(mediaItems)
      .values({
        title: String(title).trim(),
        category: String(category),
        coverImage: String(coverImage),
        description: String(description),
        genres: Array.isArray(genres) ? genres : [],
        rating: Number(rating) || 0,
        recommended: Boolean(recommended) || Number(rating) >= 8.5,
        progress: progress || {},
        owner: owner ? String(owner) : null,
      })
      .returning();

    const transformed = {
      _id: inserted.id,
      title: inserted.title,
      category: inserted.category,
      coverImage: inserted.coverImage,
      description: inserted.description,
      genres: inserted.genres || [],
      rating: inserted.rating,
      recommended: inserted.recommended,
      createdAt: inserted.createdAt.toISOString(),
      updatedAt: inserted.updatedAt.toISOString(),
      progress: inserted.progress || {},
      owner: inserted.owner || undefined,
    };

    return NextResponse.json(transformed, { status: 201 });
  } catch (error) {
    console.error("POST /api/media error:", error);
    return NextResponse.json(
      { error: "Failed to create media", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
