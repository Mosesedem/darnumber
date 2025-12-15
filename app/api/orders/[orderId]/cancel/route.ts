import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/server/auth";
import { json, error } from "@/lib/server/utils/response";
import { OrderService } from "@/lib/server/services/order.service";

export const runtime = "nodejs";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  try {
    const session = await requireAuth();
    const service = new OrderService();
    const { orderId } = await params;
    const result = await service.cancelOrder(orderId, session.user.id);
    return json({ ok: true, data: result });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unexpected error";
    const status =
      msg === "Unauthorized" ? 401 : msg.includes("not found") ? 404 : 400;
    return error(msg, status);
  }
}
