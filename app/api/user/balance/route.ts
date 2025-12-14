import { NextRequest } from "next/server";
import { json, error } from "@/lib/server/utils/response";
import { requireAuth } from "@/lib/server/auth";
import { prisma } from "@/lib/server/prisma";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth();
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { balance: true, currency: true },
    });

    if (!user) return error("User not found", 404);

    console.log("[Route][User][Balance] Fetched successfully", {
      userId: session.user.id,
      balance: user.balance,
      currency: user.currency,
    });

    return json({
      ok: true,
      data: {
        balance: Number(user.balance),
        currency: user.currency || "NGN",
      },
    });
  } catch (e) {
    if (e instanceof Error && e.message === "Unauthorized")
      return error("Unauthorized", 401);
    return error("Unexpected error", 500);
  }
}
