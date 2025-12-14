import { NextRequest } from "next/server";
import { json, error } from "@/lib/server/utils/response";
import { prisma } from "@/lib/server/prisma";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userName = searchParams.get("userName");
    if (!userName || userName.trim().length < 3) {
      return error("userName query param required (min 3 chars)", 400);
    }

    const existing = await prisma.user.findUnique({ where: { userName } });
    const available = !existing;
    return json({ ok: true, available });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unexpected error";
    return error(msg, 500);
  }
}
