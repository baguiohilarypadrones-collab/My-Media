import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { mediaItems } from "@/db/schema";
import { eq, desc, and, sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

function transformRow(row: any) {
  return {
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
  };
}

// GET /api/media/sections?category=anime&owner=...
export async function GET(request: NextRequest) {
  try {
    if (!db) {
      return NextResponse.json({ error: "Database not configured" }, { status: 503 });
    }

    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category") || "overall";
    const owner = searchParams.get("owner");

    const baseWhere = [];
    if (category !== "overall") {
      baseWhere.push(eq(mediaItems.category, category));
    }
    if (owner) {
      baseWhere.push(eq(mediaItems.owner, owner));
    }

    const whereClause = baseWhere.length > 0
      ? (baseWhere.length === 1 ? baseWhere[0] : and(...baseWhere))
      : undefined;

    // Recently Updated
    const recentlyUpdatedQuery = db.select().from(mediaItems).$dynamic();
    const recentlyUpdated = await (whereClause
      ? recentlyUpdatedQuery.where(whereClause).orderBy(desc(mediaItems.updatedAt)).limit(12)
      : recentlyUpdatedQuery.orderBy(desc(mediaItems.updatedAt)).limit(12));

    // Recommendations (rating >= 8.5)
    const recConditions = [...baseWhere, sql`${mediaItems.rating} >= 8.5`];
    const recWhere = recConditions.length === 1 ? recConditions[0] : and(...recConditions);
    const recommendations = await db
      .select()
      .from(mediaItems)
      .where(recWhere)
      .orderBy(desc(mediaItems.rating))
      .limit(12);

    // Random
    const randomQuery = db.select().from(mediaItems).$dynamic();
    const random = await (whereClause
      ? randomQuery.where(whereClause).orderBy(sql`RANDOM()`).limit(12)
      : randomQuery.orderBy(sql`RANDOM()`).limit(12));

    return NextResponse.json({
      recentlyUpdated: recentlyUpdated.map(transformRow),
      recommendations: recommendations.map(transformRow),
      random: random.map(transformRow),
    });
  } catch (error) {
    console.error("GET /api/media/sections error:", error);
    return NextResponse.json(
      { error: "Failed to load sections", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
