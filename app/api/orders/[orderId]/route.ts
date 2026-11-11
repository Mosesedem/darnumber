import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/server/auth";
import { json, error } from "@/lib/server/utils/response";
import { OrderService } from "@/lib/server/services/order.service";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  try {
    await requireAuth();

    const service = new OrderService();
    const { orderId } = await params;
    const data = await service.getOrderStatus(orderId);

    if (!data) {
      return error("Not found", 404);
    }

    return json({ ok: true, data });
  } catch (e) {
    if (e instanceof Error && e.message === "Unauthorized") {
      return error("Unauthorized", 401);
    }

    logger.error("[Order] Status fetch failed", e);
    return error("Unexpected error", 500);
  }
}
