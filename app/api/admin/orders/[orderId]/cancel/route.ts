import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/server/auth";
import { json, error } from "@/lib/server/utils/response";
import { prisma } from "@/lib/server/prisma";

export const runtime = "nodejs";

// Cancel an order
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  try {
    const session = await requireAuth();
    if (session.user.role !== "ADMIN" && session.user.role !== "SUPER_ADMIN") {
      return error("Forbidden", 403);
    }

    const { orderId } = await params;

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { user: true },
    });

    if (!order) {
      return error("Order not found", 404);
    }

    if (!["PENDING", "PROCESSING", "WAITING_FOR_SMS"].includes(order.status)) {
      return error(`Cannot cancel order with status ${order.status}`, 400);
    }

    // Update order status
    const updatedOrder = await prisma.order.update({
      where: { id: orderId },
      data: { status: "CANCELLED" },
    });

    // Log the action
    await prisma.activityLog.create({
      data: {
        userId: order.userId,
        action: "ORDER_CANCELLED_BY_ADMIN",
        resource: "order",
        resourceId: orderId,
        metadata: {
          adminId: session.user.id,
          previousStatus: order.status,
        },
      },
    });

    return json({ ok: true, data: updatedOrder });
  } catch (e) {
    console.error("Admin cancel order error:", e);
    if (e instanceof Error && e.message === "Unauthorized") {
      return error("Unauthorized", 401);
    }
    return error("Unexpected error", 500);
  }
}
