import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/server/auth";
import { json, error } from "@/lib/server/utils/response";
import { OrderService } from "@/lib/server/services/order.service";

export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  console.log("[GET /api/orders/[orderId]] Request received");

  try {
    console.log("[GET /api/orders/[orderId]] Authenticating user...");
    await requireAuth();
    console.log("[GET /api/orders/[orderId]] Authentication successful");

    const service = new OrderService();
    const { orderId } = await params;
    console.log(
      `[GET /api/orders/[orderId]] Fetching order status for orderId: ${orderId}`
    );

    const data = await service.getOrderStatus(orderId);

    if (!data) {
      console.log(`[GET /api/orders/[orderId]] Order not found: ${orderId}`);
      return error("Not found", 404);
    }

    console.log(`[GET /api/orders/[orderId]] Order found:`, {
      orderId: data.id,
      status: data.status,
      type: data.type,
    });

    return json({ ok: true, data });
  } catch (e) {
    console.error("[GET /api/orders/[orderId]] Error occurred:", e);

    if (e instanceof Error && e.message === "Unauthorized") {
      console.log("[GET /api/orders/[orderId]] Unauthorized access attempt");
      return error("Unauthorized", 401);
    }

    console.error("[GET /api/orders/[orderId]] Unexpected error:", e);
    return error("Unexpected error", 500);
  }
}
