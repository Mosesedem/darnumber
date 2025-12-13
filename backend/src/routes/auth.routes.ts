// ============================================
// AUTH ROUTES
// ============================================

import express from "express";
import { AuthService } from "../services/auth.service";
import { validateRequest } from "../middleware/validation";
import { authLimiter, publicLimiter } from "../middleware/rateLimit";
import { authenticate } from "../middleware/auth";
import {
  registerSchema,
  loginSchema,
  refreshTokenSchema,
  resetPasswordRequestSchema,
  resetPasswordSchema,
  changePasswordSchema,
} from "../schemas";
import { asyncHandler } from "../middleware/errorHandler";

const router = express.Router();
const authService = new AuthService();

// Register
router.post(
  "/register",
  publicLimiter,
  validateRequest(registerSchema),
  asyncHandler(async (req, res) => {
    const result = await authService.register(req.body);

    res.status(201).json({
      success: true,
      data: result,
    });
  })
);

// Login
router.post(
  "/login",
  authLimiter,
  validateRequest(loginSchema),
  asyncHandler(async (req, res) => {
    const result = await authService.login({
      ...req.body,
      ipAddress: req.ip,
      userAgent: req.get("user-agent"),
    });

    res.json({
      success: true,
      data: result,
    });
  })
);

// Logout
router.post(
  "/logout",
  authenticate,
  asyncHandler(async (req, res) => {
    const token = req.headers.authorization?.substring(7) || "";
    await authService.logout(token, req.user.id);

    res.json({
      success: true,
      message: "Logged out successfully",
    });
  })
);

// Refresh token
router.post(
  "/refresh",
  validateRequest(refreshTokenSchema),
  asyncHandler(async (req, res) => {
    const result = await authService.refreshToken(req.body.refreshToken);

    res.json({
      success: true,
      data: result,
    });
  })
);

// Request password reset
router.post(
  "/password-reset/request",
  authLimiter,
  validateRequest(resetPasswordRequestSchema),
  asyncHandler(async (req, res) => {
    const result = await authService.requestPasswordReset(req.body.email);

    res.json({
      success: true,
      message: result.message,
    });
  })
);

// Reset password
router.post(
  "/password-reset/confirm",
  authLimiter,
  validateRequest(resetPasswordSchema),
  asyncHandler(async (req, res) => {
    const { userId, token, newPassword } = req.body;
    const result = await authService.resetPassword(userId, token, newPassword);

    res.json({
      success: true,
      message: result.message,
    });
  })
);

// Change password (authenticated)
router.post(
  "/password/change",
  authenticate,
  validateRequest(changePasswordSchema),
  asyncHandler(async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    const result = await authService.changePassword(
      req.user.id,
      currentPassword,
      newPassword
    );

    res.json({
      success: true,
      message: result.message,
    });
  })
);

// Send verification email
router.post(
  "/verify-email/send",
  authenticate,
  asyncHandler(async (req, res) => {
    const result = await authService.sendVerificationEmail(req.user.id);

    res.json({
      success: true,
      message: result.message,
    });
  })
);

// Verify email
router.post(
  "/verify-email/confirm",
  asyncHandler(async (req, res) => {
    const { userId, token } = req.body;
    const result = await authService.verifyEmail(userId, token);

    res.json({
      success: true,
      message: result.message,
    });
  })
);

// Get current user
router.get(
  "/me",
  authenticate,
  asyncHandler(async (req, res) => {
    const { PrismaClient } = await import("@prisma/client");
    const prisma = new PrismaClient();

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
        createdAt: true,
      },
    });

    res.json({
      success: true,
      data: user,
    });
  })
);

export default router;
