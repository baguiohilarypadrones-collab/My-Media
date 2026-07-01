import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { mediaItems } from "@/db/schema";
import { eq, sql } from "drizzle-orm";

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

// PATCH /api/media/[id]/progress
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!db) {
      return NextResponse.json({ error: "Database not configured" }, { status: 503 });
    }
    const { id } = await params;
    const updates = await request.json();

    // Get current item
    const [current] = await db.select().from(mediaItems).where(eq(mediaItems.id, id)).limit(1);
    if (!current) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Merge progress
    const newProgress = {
      ...(current.progress as object || {}),
      ...updates,
    };

    const [updated] = await db
      .update(mediaItems)
      .set({
        progress: newProgress,
        updatedAt: new Date(),
      })
      .where(eq(mediaItems.id, id))
      .returning();

    return NextResponse.json(transformRow(updated));
  } catch (error) {
    console.error("PATCH /api/media/[id]/progress error:", error);
    return NextResponse.json(
      { error: "Failed to patch progress", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
