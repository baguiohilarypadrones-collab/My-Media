import { db } from "@/db";
import { sql } from "drizzle-orm";

export async function GET() {
  if (!db) {
    return Response.json({ ok: true, message: "No database configured. App runs fully client-side with localStorage." });
  }
  try {
    await db.execute(sql`select 1`);
    return Response.json({ ok: true });
  } catch {
    return Response.json({ ok: false }, { status: 500 });
  }
}
