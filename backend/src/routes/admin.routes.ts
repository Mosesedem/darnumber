// ============================================
// ADMIN ROUTES
// ============================================

import express from "express";
import {
  authenticate,
  requireAdmin,
  requireSuperAdmin,
} from "../middleware/auth";
import { validateRequest, validateQuery } from "../middleware/validation";
import { adminLimiter } from "../middleware/rateLimit";
import {
  updateUserSchema,
  adjustBalanceSchema,
  createPricingRuleSchema,
  updatePricingRuleSchema,
  updateProviderSchema,
  userFilterSchema,
  orderFilterSchema,
  activityLogFilterSchema,
  systemLogFilterSchema,
} from "../schemas";
import { asyncHandler } from "../middleware/errorHandler";
import { AdminService } from "../../../admin-service";

const router = express.Router();
const adminService = new AdminService();

// All admin routes require authentication and admin role
router.use(authenticate, requireAdmin, adminLimiter);

// ============================================
// DASHBOARD & ANALYTICS
// ============================================

router.get(
  "/dashboard",
  asyncHandler(async (req, res) => {
    const days = parseInt(req.query.days as string) || 30;
    const analytics = await adminService.getDashboardAnalytics(days);

    res.json({
      success: true,
      data: analytics,
    });
  })
);

// ============================================
// USER MANAGEMENT
// ============================================

router.get(
  "/users",
  validateQuery(userFilterSchema),
  asyncHandler(async (req, res) => {
    const result = await adminService.getUsers({
      search: req.query.search as string,
      status: req.query.status as string,
      page: parseInt(req.query.page as string),
      limit: parseInt(req.query.limit as string),
    });

    res.json({
      success: true,
      ...result,
    });
  })
);

router.get(
  "/users/:userId",
  asyncHandler(async (req, res) => {
    const result = await adminService.getUserDetails(req.params.userId);

    res.json({
      success: true,
      data: result,
    });
  })
);

router.patch(
  "/users/:userId",
  validateRequest(updateUserSchema),
  asyncHandler(async (req, res) => {
    const user = await adminService.updateUser(req.params.userId, req.body);

    res.json({
      success: true,
      data: user,
    });
  })
);

router.post(
  "/users/:userId/adjust-balance",
  validateRequest(adjustBalanceSchema),
  asyncHandler(async (req, res) => {
    const { amount, reason } = req.body;

    const result = await adminService.adjustBalance(
      req.params.userId,
      amount,
      reason,
      req.user.id
    );

    res.json({
      success: true,
      data: result,
    });
  })
);

// ============================================
// ORDER MANAGEMENT
// ============================================

router.get(
  "/orders",
  validateQuery(orderFilterSchema),
  asyncHandler(async (req, res) => {
    const result = await adminService.getOrders({
      status: req.query.status as string,
      providerId: req.query.providerId as string,
      userId: req.query.userId as string,
      startDate: req.query.startDate
        ? new Date(req.query.startDate as string)
        : undefined,
      endDate: req.query.endDate
        ? new Date(req.query.endDate as string)
        : undefined,
      page: parseInt(req.query.page as string),
      limit: parseInt(req.query.limit as string),
    });

    res.json({
      success: true,
      ...result,
    });
  })
);

router.get(
  "/orders/stats",
  asyncHandler(async (req, res) => {
    const stats = await adminService.getOrderStats(
      req.query.startDate ? new Date(req.query.startDate as string) : undefined,
      req.query.endDate ? new Date(req.query.endDate as string) : undefined
    );

    res.json({
      success: true,
      data: stats,
    });
  })
);

// ============================================
// PRICING MANAGEMENT
// ============================================

router.get(
  "/pricing-rules",
  asyncHandler(async (req, res) => {
    const rules = await adminService.getPricingRules();

    res.json({
      success: true,
      data: rules,
    });
  })
);

router.post(
  "/pricing-rules",
  validateRequest(createPricingRuleSchema),
  asyncHandler(async (req, res) => {
    const rule = await adminService.createPricingRule(req.body);

    res.status(201).json({
      success: true,
      data: rule,
    });
  })
);

router.patch(
  "/pricing-rules/:ruleId",
  validateRequest(updatePricingRuleSchema),
  asyncHandler(async (req, res) => {
    const rule = await adminService.updatePricingRule(
      req.params.ruleId,
      req.body
    );

    res.json({
      success: true,
      data: rule,
    });
  })
);

router.delete(
  "/pricing-rules/:ruleId",
  asyncHandler(async (req, res) => {
    await adminService.deletePricingRule(req.params.ruleId);

    res.json({
      success: true,
      message: "Pricing rule deleted",
    });
  })
);

// ============================================
// PROVIDER MANAGEMENT
// ============================================

router.get(
  "/providers",
  asyncHandler(async (req, res) => {
    const providers = await adminService.getProviders();

    res.json({
      success: true,
      data: providers,
    });
  })
);

router.patch(
  "/providers/:providerId",
  validateRequest(updateProviderSchema),
  asyncHandler(async (req, res) => {
    const provider = await adminService.updateProvider(
      req.params.providerId,
      req.body
    );

    res.json({
      success: true,
      data: provider,
    });
  })
);

router.post(
  "/providers/:providerId/sync",
  asyncHandler(async (req, res) => {
    const result = await adminService.syncProviderServices(
      req.params.providerId
    );

    res.json({
      success: true,
      data: result,
    });
  })
);

// ============================================
// LOGS
// ============================================

router.get(
  "/logs/activity",
  validateQuery(activityLogFilterSchema),
  asyncHandler(async (req, res) => {
    const result = await adminService.getActivityLogs({
      userId: req.query.userId as string,
      action: req.query.action as string,
      startDate: req.query.startDate
        ? new Date(req.query.startDate as string)
        : undefined,
      endDate: req.query.endDate
        ? new Date(req.query.endDate as string)
        : undefined,
      page: parseInt(req.query.page as string),
      limit: parseInt(req.query.limit as string),
    });

    res.json({
      success: true,
      ...result,
    });
  })
);

router.get(
  "/logs/system",
  validateQuery(systemLogFilterSchema),
  asyncHandler(async (req, res) => {
    const result = await adminService.getSystemLogs({
      level: req.query.level as string,
      service: req.query.service as string,
      startDate: req.query.startDate
        ? new Date(req.query.startDate as string)
        : undefined,
      endDate: req.query.endDate
        ? new Date(req.query.endDate as string)
        : undefined,
      page: parseInt(req.query.page as string),
      limit: parseInt(req.query.limit as string),
    });

    res.json({
      success: true,
      ...result,
    });
  })
);

// ============================================
// SYSTEM CONFIGURATION (Super Admin Only)
// ============================================

router.get(
  "/config",
  requireSuperAdmin,
  asyncHandler(async (req, res) => {
    const { PrismaClient } = await import("@prisma/client");
    const prisma = new PrismaClient();

    const configs = await prisma.systemConfig.findMany({
      orderBy: { key: "asc" },
    });

    res.json({
      success: true,
      data: configs,
    });
  })
);

router.patch(
  "/config/:key",
  requireSuperAdmin,
  asyncHandler(async (req, res) => {
    const { PrismaClient } = await import("@prisma/client");
    const prisma = new PrismaClient();

    const config = await prisma.systemConfig.upsert({
      where: { key: req.params.key },
      update: {
        value: req.body.value,
        description: req.body.description,
      },
      create: {
        key: req.params.key,
        value: req.body.value,
        description: req.body.description,
      },
    });

    res.json({
      success: true,
      data: config,
    });
  })
);

export default router;
