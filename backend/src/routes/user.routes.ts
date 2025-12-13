// ============================================
// USER ROUTES
// ============================================

import express from "express";
import { PrismaClient } from "@prisma/client";
import { authenticate } from "../middleware/auth";
import { validateRequest, validateQuery } from "../middleware/validation";
import { apiLimiter } from "../middleware/rateLimit";
import {
  updateProfileSchema,
  updateBankDetailsSchema,
  paginationSchema,
} from "../schemas";
import { asyncHandler } from "../middleware/errorHandler";
import { RedisService } from "../services/redis.service";

const router = express.Router();
const prisma = new PrismaClient();
const redis = new RedisService();

// Get user profile
router.get(
  "/profile",
  authenticate,
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        email: true,
        userName: true,
        phone: true,
        balance: true,
        currency: true,
        status: true,
        role: true,
        country: true,
        emailVerified: true,
        phoneVerified: true,
        referralCode: true,
        referredBy: true,
        createdAt: true,
        lastLoginAt: true,
      },
    });

    res.json({
      success: true,
      data: user,
    });
  })
);

// Update profile
router.patch(
  "/profile",
  authenticate,
  validateRequest(updateProfileSchema),
  asyncHandler(async (req, res) => {
    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: req.body,
      select: {
        id: true,
        email: true,
        userName: true,
        phone: true,
        country: true,
      },
    });

    res.json({
      success: true,
      data: user,
      message: "Profile updated successfully",
    });
  })
);

// Get user balance
router.get(
  "/balance",
  authenticate,
  asyncHandler(async (req, res) => {
    // Try cache first
    let balance = await redis.getUserBalance(req.user.id);

    if (balance === null) {
      const user = await prisma.user.findUnique({
        where: { id: req.user.id },
        select: { balance: true, currency: true },
      });

      balance = Number(user?.balance || 0);
      await redis.setUserBalance(req.user.id, balance, 30);
    }

    res.json({
      success: true,
      data: {
        balance,
        currency: "USD",
      },
    });
  })
);

// Get transaction history
router.get(
  "/transactions",
  authenticate,
  validateQuery(paginationSchema),
  asyncHandler(async (req, res) => {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;

    const [transactions, total] = await Promise.all([
      prisma.transaction.findMany({
        where: { userId: req.user.id },
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          transactionNumber: true,
          type: true,
          amount: true,
          currency: true,
          status: true,
          description: true,
          createdAt: true,
        },
      }),
      prisma.transaction.count({
        where: { userId: req.user.id },
      }),
    ]);

    res.json({
      success: true,
      data: transactions,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  })
);

// Update bank details
router.patch(
  "/bank-details",
  authenticate,
  validateRequest(updateBankDetailsSchema),
  asyncHandler(async (req, res) => {
    // In production, encrypt these details
    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: {
        bankAccount: req.body.bankAccount,
        accountNumber: req.body.accountNumber,
        bankName: req.body.bankName,
      },
    });

    res.json({
      success: true,
      message: "Bank details updated successfully",
    });
  })
);

// Get referral stats
router.get(
  "/referrals",
  authenticate,
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { referralCode: true },
    });

    const [referrals, totalEarnings] = await Promise.all([
      prisma.referral.findMany({
        where: { referrerId: req.user.id },
        include: {
          referred: {
            select: {
              userName: true,
              email: true,
              createdAt: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.referral.aggregate({
        where: {
          referrerId: req.user.id,
          rewardPaid: true,
        },
        _sum: {
          referrerReward: true,
        },
      }),
    ]);

    res.json({
      success: true,
      data: {
        referralCode: user?.referralCode,
        totalReferrals: referrals.length,
        totalEarnings: totalEarnings._sum.referrerReward || 0,
        referrals: referrals.map((r) => ({
          userName: r.referred.userName,
          email: r.referred.email,
          reward: r.referrerReward,
          rewardPaid: r.rewardPaid,
          joinedAt: r.createdAt,
        })),
      },
    });
  })
);

// Get user statistics
router.get(
  "/stats",
  authenticate,
  asyncHandler(async (req, res) => {
    const [orderStats, totalSpent, recentOrders] = await Promise.all([
      prisma.order.groupBy({
        by: ["status"],
        where: { userId: req.user.id },
        _count: true,
      }),
      prisma.order.aggregate({
        where: {
          userId: req.user.id,
          status: "COMPLETED",
        },
        _sum: {
          finalPrice: true,
        },
      }),
      prisma.order.findMany({
        where: { userId: req.user.id },
        take: 5,
        orderBy: { createdAt: "desc" },
        select: {
          orderNumber: true,
          serviceCode: true,
          status: true,
          finalPrice: true,
          createdAt: true,
        },
      }),
    ]);

    const ordersByStatus = orderStats.reduce((acc: any, stat) => {
      acc[stat.status] = stat._count;
      return acc;
    }, {});

    res.json({
      success: true,
      data: {
        totalOrders: orderStats.reduce((sum, stat) => sum + stat._count, 0),
        ordersByStatus,
        totalSpent: totalSpent._sum.finalPrice || 0,
        recentOrders,
      },
    });
  })
);

// Get activity logs
router.get(
  "/activity",
  authenticate,
  validateQuery(paginationSchema),
  asyncHandler(async (req, res) => {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;

    const [logs, total] = await Promise.all([
      prisma.activityLog.findMany({
        where: { userId: req.user.id },
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        select: {
          action: true,
          resource: true,
          ipAddress: true,
          metadata: true,
          createdAt: true,
        },
      }),
      prisma.activityLog.count({
        where: { userId: req.user.id },
      }),
    ]);

    res.json({
      success: true,
      data: logs,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  })
);

export default router;
