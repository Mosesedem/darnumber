// ============================================
// ORDER ROUTES
// ============================================

import express from "express";
import { PrismaClient } from "@prisma/client";
import { authenticate } from "../middleware/auth";
import { validateRequest, validateQuery } from "../middleware/validation";
import { orderLimiter, apiLimiter } from "../middleware/rateLimit";
import { createOrderSchema, orderIdSchema, paginationSchema } from "../schemas";
import { asyncHandler } from "../middleware/errorHandler";
import { OrderService } from "../../../order-service";

const router = express.Router();
const prisma = new PrismaClient();
const orderService = new OrderService();

// Create order
router.post(
  "/",
  authenticate,
  orderLimiter,
  validateRequest(createOrderSchema),
  asyncHandler(async (req, res) => {
    const order = await orderService.createOrder({
      userId: req.user.id,
      serviceCode: req.body.serviceCode,
      country: req.body.country,
      preferredProvider: req.body.provider,
    });

    res.status(201).json({
      success: true,
      data: order,
    });
  })
);

// Get order status
router.get(
  "/:orderId",
  authenticate,
  asyncHandler(async (req, res) => {
    const order = await orderService.getOrderStatus(req.params.orderId);

    if (!order) {
      return res.status(404).json({
        success: false,
        error: "Order not found",
      });
    }

    // Verify order belongs to user (unless admin)
    if (order.userId !== req.user.id && req.user.role !== "ADMIN") {
      return res.status(403).json({
        success: false,
        error: "Access denied",
      });
    }

    res.json({
      success: true,
      data: order,
    });
  })
);

// List user orders
router.get(
  "/",
  authenticate,
  apiLimiter,
  validateQuery(paginationSchema),
  asyncHandler(async (req, res) => {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where: { userId: req.user.id },
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          orderNumber: true,
          serviceCode: true,
          country: true,
          phoneNumber: true,
          status: true,
          smsCode: true,
          finalPrice: true,
          currency: true,
          createdAt: true,
          expiresAt: true,
          completedAt: true,
        },
      }),
      prisma.order.count({
        where: { userId: req.user.id },
      }),
    ]);

    res.json({
      success: true,
      data: orders,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  })
);

// Get available services
router.get(
  "/services/available",
  authenticate,
  apiLimiter,
  asyncHandler(async (req, res) => {
    const { country, serviceCode } = req.query;

    const where: any = {
      isActive: true,
      available: true,
    };

    if (country) where.country = country;
    if (serviceCode) where.serviceCode = serviceCode;

    const services = await prisma.service.findMany({
      where,
      include: {
        provider: {
          select: {
            id: true,
            name: true,
            displayName: true,
            healthStatus: true,
          },
        },
      },
      orderBy: [{ provider: { priority: "desc" } }, { serviceCode: "asc" }],
    });

    // Group by service code and country
    const grouped = services.reduce((acc: any, service: any) => {
      const key = `${service.serviceCode}-${service.country}`;
      if (!acc[key]) {
        acc[key] = {
          serviceCode: service.serviceCode,
          serviceName: service.serviceName,
          country: service.country,
          providers: [],
        };
      }
      acc[key].providers.push({
        id: service.provider.id,
        name: service.provider.name,
        displayName: service.provider.displayName,
        healthStatus: service.provider.healthStatus,
      });
      return acc;
    }, {});

    res.json({
      success: true,
      data: Object.values(grouped),
    });
  })
);

// Cancel order
router.post(
  "/:orderId/cancel",
  authenticate,
  asyncHandler(async (req, res) => {
    const order = await prisma.order.findUnique({
      where: { id: req.params.orderId },
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        error: "Order not found",
      });
    }

    if (order.userId !== req.user.id) {
      return res.status(403).json({
        success: false,
        error: "Access denied",
      });
    }

    if (order.status === "COMPLETED") {
      return res.status(400).json({
        success: false,
        error: "Cannot cancel completed order",
      });
    }

    if (order.status === "CANCELLED" || order.status === "REFUNDED") {
      return res.status(400).json({
        success: false,
        error: "Order already cancelled",
      });
    }

    // Refund order
    await orderService.refundOrder(order.id);

    res.json({
      success: true,
      message: "Order cancelled and refunded",
    });
  })
);

export default router;
