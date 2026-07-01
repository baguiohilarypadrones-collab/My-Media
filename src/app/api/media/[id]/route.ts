import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { mediaItems } from "@/db/schema";
import { eq } from "drizzle-orm";

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

// GET /api/media/[id]
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!db) {
      return NextResponse.json({ error: "Database not configured" }, { status: 503 });
    }
    const { id } = await params;
    const [row] = await db.select().from(mediaItems).where(eq(mediaItems.id, id)).limit(1);
    if (!row) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json(transformRow(row));
  } catch (error) {
    console.error("GET /api/media/[id] error:", error);
    return NextResponse.json({ error: "Failed to fetch" }, { status: 500 });
  }
}

// PUT /api/media/[id]
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!db) {
      return NextResponse.json({ error: "Database not configured" }, { status: 503 });
    }
    const { id } = await params;
    const body = await request.json();

    const updateData: any = {
      updatedAt: new Date(),
    };

    if (body.title !== undefined) updateData.title = String(body.title);
    if (body.category !== undefined) updateData.category = String(body.category);
    if (body.coverImage !== undefined) updateData.coverImage = String(body.coverImage);
    if (body.description !== undefined) updateData.description = String(body.description);
    if (body.genres !== undefined) updateData.genres = Array.isArray(body.genres) ? body.genres : [];
    if (body.rating !== undefined) updateData.rating = Number(body.rating) || 0;
    if (body.recommended !== undefined) updateData.recommended = Boolean(body.recommended);
    if (body.progress !== undefined) updateData.progress = body.progress;
    if (body.owner !== undefined) updateData.owner = body.owner ? String(body.owner) : null;

    // auto-recommended flag
    if (updateData.rating >= 8.5) {
      updateData.recommended = true;
    }

    const [updated] = await db
      .update(mediaItems)
      .set(updateData)
      .where(eq(mediaItems.id, id))
      .returning();

    if (!updated) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json(transformRow(updated));
  } catch (error) {
    console.error("PUT /api/media/[id] error:", error);
    return NextResponse.json({ error: "Failed to update" }, { status: 500 });
  }
}

// DELETE /api/media/[id]
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!db) {
      return NextResponse.json({ error: "Database not configured" }, { status: 503 });
    }
    const { id } = await params;
    const [deleted] = await db.delete(mediaItems).where(eq(mediaItems.id, id)).returning({ id: mediaItems.id });
    if (!deleted) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true, id: deleted.id });
  } catch (error) {
    console.error("DELETE /api/media/[id] error:", error);
    return NextResponse.json({ error: "Failed to delete" }, { status: 500 });
  }
}
