// ============================================
// PAYMENT ROUTES
// ============================================

import express from "express";
import { authenticate } from "../middleware/auth";
import { validateRequest, validateQuery } from "../middleware/validation";
import { paymentLimiter, apiLimiter } from "../middleware/rateLimit";
import {
  createPaymentIntentSchema,
  withdrawalRequestSchema,
  paginationSchema,
} from "../schemas";
import { asyncHandler } from "../middleware/errorHandler";
import { PaymentService } from "../services/payment.service";

const router = express.Router();
const paymentService = new PaymentService();

// Create payment intent (deposit)
router.post(
  "/deposit",
  authenticate,
  paymentLimiter,
  validateRequest(createPaymentIntentSchema),
  asyncHandler(async (req, res) => {
    const result = await paymentService.createPaymentIntent({
      userId: req.user.id,
      amount: req.body.amount,
      currency: req.body.currency || "USD",
      metadata: {
        userEmail: req.user.email,
      },
    });

    res.status(201).json({
      success: true,
      data: result,
    });
  })
);

// Request withdrawal
router.post(
  "/withdraw",
  authenticate,
  paymentLimiter,
  validateRequest(withdrawalRequestSchema),
  asyncHandler(async (req, res) => {
    const result = await paymentService.requestWithdrawal(
      req.user.id,
      req.body.amount,
      req.body.bankDetails
    );

    res.json({
      success: true,
      message: result.message,
    });
  })
);

// Get payment history
router.get(
  "/history",
  authenticate,
  apiLimiter,
  validateQuery(paginationSchema),
  asyncHandler(async (req, res) => {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;

    const result = await paymentService.getPaymentHistory(
      req.user.id,
      page,
      limit
    );

    res.json({
      success: true,
      ...result,
    });
  })
);

// Get payment methods
router.get(
  "/methods",
  authenticate,
  asyncHandler(async (req, res) => {
    const result = await paymentService.getPaymentMethods(req.user.id);

    res.json({
      success: true,
      data: result,
    });
  })
);

// Stripe webhook
router.post(
  "/webhook",
  express.raw({ type: "application/json" }),
  asyncHandler(async (req, res) => {
    const signature = req.headers["stripe-signature"] as string;

    if (!signature) {
      return res.status(400).json({
        success: false,
        error: "Missing stripe signature",
      });
    }

    await paymentService.handleStripeWebhook(req.body.toString(), signature);

    res.json({ received: true });
  })
);

export default router;
