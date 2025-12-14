import { NextRequest } from "next/server";
import { json, error } from "@/lib/server/utils/response";
import { requireAuth } from "@/lib/server/auth";
import { prisma } from "@/lib/server/prisma";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth();
    const sp = new URL(req.url).searchParams;
    const page = Number(sp.get("page") || 1);
    const limit = Number(sp.get("limit") || 20);
    const skip = (page - 1) * limit;

    const [transactions, total] = await Promise.all([
      prisma.transaction.findMany({
        where: { userId: session.user.id },
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          transactionNumber: true,
          type: true,
          amount: true,
          currency: true,
          balanceBefore: true,
          balanceAfter: true,
          orderId: true,
          referenceId: true,
          paymentMethod: true,
          status: true,
          description: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      prisma.transaction.count({ where: { userId: session.user.id } }),
    ]);

    console.log("[Route][Users][Transactions] Fetched successfully", {
      userId: session.user.id,
      page,
      total,
    });

    return json({
      ok: true,
      data: {
        transactions: transactions.map((t) => ({
          ...t,
          amount: Number(t.amount),
          balanceBefore: Number(t.balanceBefore),
          balanceAfter: Number(t.balanceAfter),
        })),
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      },
    });
  } catch (e) {
    console.error("[Route][Users][Transactions] Error:", e);
    if (e instanceof Error && e.message === "Unauthorized")
      return error("Unauthorized", 401);
    return error("Unexpected error", 500);
  }
}
