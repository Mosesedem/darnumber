// ============================================
// PAYMENT SERVICE - Stripe Integration
// ============================================

import Stripe from "stripe";
import { PrismaClient } from "@prisma/client";
import { RedisService } from "./redis.service";

const prisma = new PrismaClient();
const redis = new RedisService();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2024-12-18.acacia",
});

interface CreatePaymentIntentInput {
  userId: string;
  amount: number;
  currency?: string;
  metadata?: any;
}

export class PaymentService {
  // ============================================
  // STRIPE PAYMENT INTENT
  // ============================================

  async createPaymentIntent(input: CreatePaymentIntentInput) {
    const { userId, amount, currency = "USD", metadata = {} } = input;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, userName: true },
    });

    if (!user) {
      throw new Error("User not found");
    }

    // Create payment intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // Convert to cents
      currency: currency.toLowerCase(),
      metadata: {
        userId,
        userName: user.userName,
        ...metadata,
      },
      automatic_payment_methods: {
        enabled: true,
      },
    });

    // Create pending transaction
    const transaction = await prisma.transaction.create({
      data: {
        userId,
        transactionNumber: `DEP-${Date.now()}-${Math.random()
          .toString(36)
          .substr(2, 9)}`,
        type: "DEPOSIT",
        amount,
        currency,
        balanceBefore: user.balance,
        balanceAfter: user.balance,
        status: "PENDING",
        description: "Deposit via Stripe",
        referenceId: paymentIntent.id,
        paymentMethod: "stripe",
        paymentDetails: {
          clientSecret: paymentIntent.client_secret,
        },
      },
    });

    return {
      clientSecret: paymentIntent.client_secret,
      transactionId: transaction.id,
      transactionNumber: transaction.transactionNumber,
    };
  }

  // ============================================
  // STRIPE WEBHOOK HANDLER
  // ============================================

  async handleStripeWebhook(payload: string, signature: string) {
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

    let event: Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);
    } catch (error: any) {
      console.error("Webhook signature verification failed:", error.message);
      throw new Error("Invalid signature");
    }

    switch (event.type) {
      case "payment_intent.succeeded":
        await this.handlePaymentSuccess(
          event.data.object as Stripe.PaymentIntent
        );
        break;

      case "payment_intent.payment_failed":
        await this.handlePaymentFailure(
          event.data.object as Stripe.PaymentIntent
        );
        break;

      case "charge.refunded":
        await this.handleRefund(event.data.object as Stripe.Charge);
        break;

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return { received: true };
  }

  private async handlePaymentSuccess(paymentIntent: Stripe.PaymentIntent) {
    const userId = paymentIntent.metadata.userId;
    const amount = paymentIntent.amount / 100; // Convert from cents

    // Find pending transaction
    const transaction = await prisma.transaction.findFirst({
      where: {
        referenceId: paymentIntent.id,
        status: "PENDING",
      },
    });

    if (!transaction) {
      console.error(`Transaction not found for payment: ${paymentIntent.id}`);
      return;
    }

    // Update user balance and transaction in a single transaction
    await prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({
        where: { id: userId },
        select: { balance: true, currency: true },
      });

      if (!user) return;

      const newBalance = Number(user.balance) + amount;

      // Update balance
      await tx.user.update({
        where: { id: userId },
        data: { balance: newBalance },
      });

      // Update transaction
      await tx.transaction.update({
        where: { id: transaction.id },
        data: {
          status: "COMPLETED",
          balanceAfter: newBalance,
        },
      });

      // Log activity
      await tx.activityLog.create({
        data: {
          userId,
          action: "PAYMENT_COMPLETED",
          resource: "transaction",
          resourceId: transaction.id,
          metadata: {
            amount,
            paymentIntentId: paymentIntent.id,
          },
        },
      });
    });

    // Invalidate balance cache
    await redis.invalidateUserBalance(userId);

    // Send notification
    const { notificationQueue } = await import("./queue.service");
    await notificationQueue.add({
      type: "PAYMENT_RECEIVED",
      userId,
      amount,
      currency: transaction.currency,
      transactionNumber: transaction.transactionNumber,
      newBalance: Number(transaction.balanceAfter),
    });

    console.log(`✅ Payment completed for user ${userId}: $${amount}`);
  }

  private async handlePaymentFailure(paymentIntent: Stripe.PaymentIntent) {
    const transaction = await prisma.transaction.findFirst({
      where: {
        referenceId: paymentIntent.id,
        status: "PENDING",
      },
    });

    if (!transaction) return;

    await prisma.transaction.update({
      where: { id: transaction.id },
      data: {
        status: "FAILED",
        adminNotes: `Payment failed: ${
          paymentIntent.last_payment_error?.message || "Unknown error"
        }`,
      },
    });

    console.log(`❌ Payment failed: ${paymentIntent.id}`);
  }

  private async handleRefund(charge: Stripe.Charge) {
    // Handle refund logic
    console.log(`💸 Refund processed: ${charge.id}`);
  }

  // ============================================
  // WITHDRAWAL (Bank Transfer)
  // ============================================

  async requestWithdrawal(userId: string, amount: number, bankDetails: any) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new Error("User not found");
    }

    if (Number(user.balance) < amount) {
      throw new Error("Insufficient balance");
    }

    // Minimum withdrawal amount
    if (amount < 10) {
      throw new Error("Minimum withdrawal amount is $10");
    }

    // Create withdrawal transaction
    await prisma.$transaction(async (tx) => {
      // Deduct balance
      await tx.user.update({
        where: { id: userId },
        data: {
          balance: { decrement: amount },
        },
      });

      // Create transaction record
      await tx.transaction.create({
        data: {
          userId,
          transactionNumber: `WD-${Date.now()}-${Math.random()
            .toString(36)
            .substr(2, 9)}`,
          type: "WITHDRAWAL",
          amount,
          currency: user.currency,
          balanceBefore: user.balance,
          balanceAfter: Number(user.balance) - amount,
          status: "PENDING",
          description: "Withdrawal to bank account",
          paymentMethod: "bank_transfer",
          paymentDetails: bankDetails,
        },
      });
    });

    // Invalidate balance cache
    await redis.invalidateUserBalance(userId);

    return {
      message:
        "Withdrawal request submitted. Processing time: 1-3 business days",
    };
  }

  // ============================================
  // PAYMENT METHODS
  // ============================================

  async getPaymentMethods(userId: string) {
    // Get saved payment methods from Stripe
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });

    if (!user) {
      throw new Error("User not found");
    }

    // In production, you'd search for customer by email or store Stripe customer ID
    // For now, return empty array
    return {
      paymentMethods: [],
    };
  }

  // ============================================
  // PAYMENT HISTORY
  // ============================================

  async getPaymentHistory(
    userId: string,
    page: number = 1,
    limit: number = 20
  ) {
    const skip = (page - 1) * limit;

    const [transactions, total] = await Promise.all([
      prisma.transaction.findMany({
        where: {
          userId,
          type: { in: ["DEPOSIT", "WITHDRAWAL"] },
        },
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
      }),
      prisma.transaction.count({
        where: {
          userId,
          type: { in: ["DEPOSIT", "WITHDRAWAL"] },
        },
      }),
    ]);

    return {
      transactions,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }
}
