// ============================================
// QUEUE SERVICE - Background Job Processing with Bull
// ============================================

import Queue from "bull";
import { PrismaClient } from "@prisma/client";
import { RedisService } from "./redis.service";

const prisma = new PrismaClient();
const redis = new RedisService();

// ============================================
// QUEUE DEFINITIONS
// ============================================

export const orderMonitorQueue = new Queue("order-monitor", {
  redis: {
    host: process.env.REDIS_HOST || "localhost",
    port: parseInt(process.env.REDIS_PORT || "6379"),
    password: process.env.REDIS_PASSWORD,
  },
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 5000,
    },
    removeOnComplete: 100,
    removeOnFail: 500,
  },
});

export const providerSyncQueue = new Queue("provider-sync", {
  redis: {
    host: process.env.REDIS_HOST || "localhost",
    port: parseInt(process.env.REDIS_PORT || "6379"),
    password: process.env.REDIS_PASSWORD,
  },
  defaultJobOptions: {
    attempts: 2,
    backoff: {
      type: "fixed",
      delay: 10000,
    },
    removeOnComplete: 50,
    removeOnFail: 200,
  },
});

export const cleanupQueue = new Queue("cleanup", {
  redis: {
    host: process.env.REDIS_HOST || "localhost",
    port: parseInt(process.env.REDIS_PORT || "6379"),
    password: process.env.REDIS_PASSWORD,
  },
});

export const notificationQueue = new Queue("notifications", {
  redis: {
    host: process.env.REDIS_HOST || "localhost",
    port: parseInt(process.env.REDIS_PORT || "6379"),
    password: process.env.REDIS_PASSWORD,
  },
  defaultJobOptions: {
    attempts: 5,
    backoff: {
      type: "exponential",
      delay: 2000,
    },
  },
});

// ============================================
// ORDER MONITOR PROCESSOR
// ============================================

orderMonitorQueue.process(10, async (job) => {
  const { orderId } = job.data;

  try {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        provider: true,
        user: true,
      },
    });

    if (!order) {
      console.log(`Order ${orderId} not found`);
      return;
    }

    // Skip if order is not waiting for SMS
    if (order.status !== "WAITING_SMS") {
      console.log(`Order ${orderId} status is ${order.status}, skipping`);
      return;
    }

    // Check if order has expired
    if (new Date() > order.expiresAt) {
      console.log(`Order ${orderId} has expired`);
      await handleExpiredOrder(order);
      return;
    }

    // Check SMS status from provider
    const smsStatus = await checkSMSFromProvider(order);

    if (smsStatus.received) {
      // SMS received - complete the order
      await prisma.order.update({
        where: { id: orderId },
        data: {
          status: "COMPLETED",
          smsCode: smsStatus.code,
          smsText: smsStatus.text,
          receivedAt: new Date(),
          completedAt: new Date(),
        },
      });

      // Invalidate cache
      await redis.invalidateOrder(orderId);

      // Send notification
      await notificationQueue.add({
        type: "SMS_RECEIVED",
        userId: order.userId,
        orderId: order.id,
        phoneNumber: order.phoneNumber,
        smsCode: smsStatus.code,
      });

      console.log(`✅ Order ${orderId} completed with SMS code`);
    } else {
      // SMS not received yet - re-queue for checking
      const timeUntilExpiry = order.expiresAt.getTime() - Date.now();

      if (timeUntilExpiry > 10000) {
        await orderMonitorQueue.add(
          { orderId },
          { delay: Math.min(10000, timeUntilExpiry - 5000) }
        );
      }
    }
  } catch (error) {
    console.error(`Error processing order ${orderId}:`, error);
    throw error; // Will trigger retry
  }
});

async function checkSMSFromProvider(order: any): Promise<any> {
  const { SMSManService } = await import("./smsMan.service");
  const { TextVerifiedService } = await import("./textVerified.service");

  let providerService: any;

  switch (order.provider.name) {
    case "sms-man":
      providerService = new SMSManService();
      break;
    case "textverified":
      providerService = new TextVerifiedService();
      break;
    default:
      throw new Error(`Unknown provider: ${order.provider.name}`);
  }

  return await providerService.getSMS(order.providerOrderId);
}

async function handleExpiredOrder(order: any): Promise<void> {
  const { SMSManService } = await import("./smsMan.service");
  const { TextVerifiedService } = await import("./textVerified.service");

  // Close the request with provider
  let providerService: any;

  switch (order.provider.name) {
    case "sms-man":
      providerService = new SMSManService();
      break;
    case "textverified":
      providerService = new TextVerifiedService();
      break;
    default:
      console.error(`Unknown provider: ${order.provider.name}`);
      return;
  }

  try {
    await providerService.closeRequest(order.providerOrderId);
  } catch (error) {
    console.error(`Error closing provider request:`, error);
  }

  // Update order status
  await prisma.order.update({
    where: { id: order.id },
    data: {
      status: "EXPIRED",
      cancelledAt: new Date(),
    },
  });

  // Refund user
  await refundExpiredOrder(order);

  // Invalidate cache
  await redis.invalidateOrder(order.id);

  // Send notification
  await notificationQueue.add({
    type: "ORDER_EXPIRED",
    userId: order.userId,
    orderId: order.id,
  });

  console.log(`⏱️  Order ${order.id} marked as expired and refunded`);
}

async function refundExpiredOrder(order: any): Promise<void> {
  await prisma.$transaction(async (tx) => {
    // Refund balance
    await tx.user.update({
      where: { id: order.userId },
      data: {
        balance: { increment: order.finalPrice },
      },
    });

    // Create refund transaction
    await tx.transaction.create({
      data: {
        userId: order.userId,
        transactionNumber: `REFUND-${Date.now()}-${Math.random()
          .toString(36)
          .substr(2, 9)}`,
        type: "REFUND",
        amount: order.finalPrice,
        currency: order.currency,
        balanceBefore: order.user.balance,
        balanceAfter: order.user.balance + Number(order.finalPrice),
        orderId: order.id,
        status: "COMPLETED",
        description: `Refund for expired order ${order.orderNumber}`,
      },
    });
  });

  // Invalidate user balance cache
  await redis.invalidateUserBalance(order.userId);
}

// ============================================
// PROVIDER SYNC PROCESSOR
// ============================================

providerSyncQueue.process(5, async (job) => {
  const { providerId } = job.data;

  try {
    const provider = await prisma.provider.findUnique({
      where: { id: providerId },
    });

    if (!provider || !provider.isActive) {
      console.log(`Provider ${providerId} not found or inactive`);
      return;
    }

    console.log(`🔄 Syncing provider: ${provider.name}`);

    // Import provider service dynamically
    const { syncProviderServices } = await import("./providerSync.service");
    await syncProviderServices(providerId);

    // Update last health check
    await prisma.provider.update({
      where: { id: providerId },
      data: {
        lastHealthCheck: new Date(),
        healthStatus: "HEALTHY",
      },
    });

    // Update cache
    await redis.setProviderHealth(provider.name, "HEALTHY", 300);

    console.log(`✅ Provider ${provider.name} synced successfully`);
  } catch (error) {
    console.error(`Error syncing provider ${providerId}:`, error);

    // Mark provider as degraded
    await prisma.provider.update({
      where: { id: providerId },
      data: {
        healthStatus: "DEGRADED",
        lastHealthCheck: new Date(),
      },
    });

    throw error;
  }
});

// ============================================
// CLEANUP PROCESSOR
// ============================================

cleanupQueue.process(async (job) => {
  const { type } = job.data;

  try {
    switch (type) {
      case "expired-sessions":
        await cleanupExpiredSessions();
        break;
      case "old-logs":
        await cleanupOldLogs();
        break;
      case "completed-orders":
        await cleanupCompletedOrders();
        break;
      default:
        console.log(`Unknown cleanup type: ${type}`);
    }
  } catch (error) {
    console.error(`Cleanup error for ${type}:`, error);
    throw error;
  }
});

async function cleanupExpiredSessions(): Promise<void> {
  const result = await prisma.session.deleteMany({
    where: {
      expiresAt: {
        lt: new Date(),
      },
    },
  });

  console.log(`🧹 Cleaned up ${result.count} expired sessions`);
}

async function cleanupOldLogs(): Promise<void> {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const [activityLogs, systemLogs] = await Promise.all([
    prisma.activityLog.deleteMany({
      where: {
        createdAt: {
          lt: thirtyDaysAgo,
        },
      },
    }),
    prisma.systemLog.deleteMany({
      where: {
        createdAt: {
          lt: thirtyDaysAgo,
        },
        level: {
          in: ["DEBUG", "INFO"],
        },
      },
    }),
  ]);

  console.log(
    `🧹 Cleaned up ${activityLogs.count} activity logs and ${systemLogs.count} system logs`
  );
}

async function cleanupCompletedOrders(): Promise<void> {
  // Archive orders older than 90 days
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

  const result = await prisma.order.updateMany({
    where: {
      status: "COMPLETED",
      completedAt: {
        lt: ninetyDaysAgo,
      },
    },
    data: {
      metadata: {
        archived: true,
        archivedAt: new Date().toISOString(),
      },
    },
  });

  console.log(`🧹 Archived ${result.count} old completed orders`);
}

// ============================================
// NOTIFICATION PROCESSOR
// ============================================

notificationQueue.process(20, async (job) => {
  const { type, userId, ...data } = job.data;

  try {
    const { NotificationService } = await import("./notification.service");
    const notificationService = new NotificationService();

    switch (type) {
      case "SMS_RECEIVED":
        await notificationService.sendSMSReceivedNotification(userId, data);
        break;
      case "ORDER_EXPIRED":
        await notificationService.sendOrderExpiredNotification(userId, data);
        break;
      case "PAYMENT_RECEIVED":
        await notificationService.sendPaymentReceivedNotification(userId, data);
        break;
      case "LOW_BALANCE":
        await notificationService.sendLowBalanceNotification(userId, data);
        break;
      default:
        console.log(`Unknown notification type: ${type}`);
    }
  } catch (error) {
    console.error(`Notification error for ${type}:`, error);
    throw error;
  }
});

// ============================================
// QUEUE EVENTS & MONITORING
// ============================================

orderMonitorQueue.on("completed", (job) => {
  console.log(`✅ Order monitor job ${job.id} completed`);
});

orderMonitorQueue.on("failed", (job, err) => {
  console.error(`❌ Order monitor job ${job?.id} failed:`, err.message);
});

providerSyncQueue.on("completed", (job) => {
  console.log(`✅ Provider sync job ${job.id} completed`);
});

providerSyncQueue.on("failed", (job, err) => {
  console.error(`❌ Provider sync job ${job?.id} failed:`, err.message);
});

// ============================================
// SCHEDULED JOBS
// ============================================

export async function setupScheduledJobs(): Promise<void> {
  // Sync providers every 5 minutes
  const providers = await prisma.provider.findMany({
    where: { isActive: true },
  });

  for (const provider of providers) {
    await providerSyncQueue.add(
      { providerId: provider.id },
      {
        repeat: {
          every: 5 * 60 * 1000, // 5 minutes
        },
      }
    );
  }

  // Cleanup jobs
  await cleanupQueue.add(
    { type: "expired-sessions" },
    {
      repeat: {
        cron: "0 * * * *", // Every hour
      },
    }
  );

  await cleanupQueue.add(
    { type: "old-logs" },
    {
      repeat: {
        cron: "0 2 * * *", // 2 AM daily
      },
    }
  );

  await cleanupQueue.add(
    { type: "completed-orders" },
    {
      repeat: {
        cron: "0 3 * * 0", // 3 AM every Sunday
      },
    }
  );

  console.log("✅ Scheduled jobs configured");
}

// ============================================
// GRACEFUL SHUTDOWN
// ============================================

export async function closeQueues(): Promise<void> {
  await Promise.all([
    orderMonitorQueue.close(),
    providerSyncQueue.close(),
    cleanupQueue.close(),
    notificationQueue.close(),
  ]);
  console.log("✅ All queues closed");
}
