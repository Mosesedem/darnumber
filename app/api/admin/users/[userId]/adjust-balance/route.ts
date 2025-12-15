import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/server/auth";
import { json, error } from "@/lib/server/utils/response";
import { AdminService } from "@/lib/server/services/admin.service";

export const runtime = "nodejs";

export async function POST(
  req: NextRequest,
  { params }: { params: { userId: string } }
) {
  try {
    const session = await requireAuth();
    if (session.user.role !== "ADMIN" && session.user.role !== "SUPER_ADMIN")
      return error("Forbidden", 403);
    const body = await req.json();
    const { amount, reason } = body || {};
    if (typeof amount !== "number" || !reason)
      return error("amount and reason required", 400);
    const svc = new AdminService();
    const data = await svc.adjustBalance(
      params.userId,
      amount,
      reason,
      session.user.id
    );
    return json({ ok: true, data });
  } catch (e) {
    if (e instanceof Error && e.message === "Unauthorized")
      return error("Unauthorized", 401);
    return error("Unexpected error", 500);
  }
}
