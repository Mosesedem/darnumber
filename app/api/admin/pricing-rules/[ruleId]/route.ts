import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/server/auth";
import { json, error } from "@/lib/server/utils/response";
import { AdminService } from "@/lib/server/services/admin.service";

export const runtime = "nodejs";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ ruleId: string }> }
) {
  try {
    const session = await requireAuth();
    if (session.user.role !== "ADMIN" && session.user.role !== "SUPER_ADMIN")
      return error("Forbidden", 403);
    const body = await req.json();
    const { ruleId } = await params;
    const svc = new AdminService();
    const data = await svc.updatePricingRule(ruleId, body);
    return json({ ok: true, data });
  } catch (e) {
    if (e instanceof Error && e.message === "Unauthorized")
      return error("Unauthorized", 401);
    return error("Unexpected error", 500);
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ ruleId: string }> }
) {
  try {
    const session = await requireAuth();
    if (session.user.role !== "ADMIN" && session.user.role !== "SUPER_ADMIN")
      return error("Forbidden", 403);
    const { ruleId } = await params;
    const svc = new AdminService();
    await svc.deletePricingRule(ruleId);
    return json({ ok: true });
  } catch (e) {
    if (e instanceof Error && e.message === "Unauthorized")
      return error("Unauthorized", 401);
    return error("Unexpected error", 500);
  }
}
