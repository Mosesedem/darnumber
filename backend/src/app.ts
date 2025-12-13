// ============================================
// MAIN EXPRESS APPLICATION
// ============================================

import express, { Express } from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import { connectDatabase } from "./config/database";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler";
import { logger, stream } from "./utils/logger";
import { setupScheduledJobs, closeQueues } from "./services/queue.service";

// Import routes
import authRoutes from "./routes/auth.routes";
import orderRoutes from "./routes/order.routes";
import userRoutes from "./routes/user.routes";
import paymentRoutes from "./routes/payment.routes";
import adminRoutes from "./routes/admin.routes";

const app: Express = express();
const PORT = process.env.PORT || 3000;

// ============================================
// MIDDLEWARE SETUP
// ============================================

// Security
app.use(helmet());

// CORS
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "*",
    credentials: true,
  })
);

// Body parsing
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// HTTP logging
app.use(morgan("combined", { stream }));

// Request ID middleware
app.use((req, res, next) => {
  req.id = Math.random().toString(36).substring(7);
  res.setHeader("X-Request-Id", req.id);
  next();
});

// ============================================
// HEALTH CHECK
// ============================================

app.get("/health", async (req, res) => {
  const { checkDatabaseHealth } = await import("./config/database");
  const { RedisService } = await import("./services/redis.service");

  const redis = new RedisService();

  const dbHealthy = await checkDatabaseHealth();
  const redisHealthy = await redis.ping();

  const status = dbHealthy && redisHealthy ? "healthy" : "unhealthy";

  res.status(status === "healthy" ? 200 : 503).json({
    status,
    timestamp: new Date().toISOString(),
    services: {
      database: dbHealthy ? "up" : "down",
      redis: redisHealthy ? "up" : "down",
    },
  });
});

app.get("/", (req, res) => {
  res.json({
    name: "SMS Verification Service API",
    version: "1.0.0",
    status: "running",
    documentation: "/api/docs",
  });
});

// ============================================
// API ROUTES
// ============================================

app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/orders", orderRoutes);
app.use("/api/v1/users", userRoutes);
app.use("/api/v1/payments", paymentRoutes);
app.use("/api/v1/admin", adminRoutes);

// ============================================
// ERROR HANDLING
// ============================================

app.use(notFoundHandler);
app.use(errorHandler);

// ============================================
// SERVER STARTUP
// ============================================

async function startServer() {
  try {
    // Connect to database
    await connectDatabase();

    // Setup background jobs
    await setupScheduledJobs();
    logger.info("Background jobs configured");

    // Start server
    app.listen(PORT, () => {
      logger.info(`🚀 Server running on port ${PORT}`);
      logger.info(`Environment: ${process.env.NODE_ENV || "development"}`);
      logger.info(`Health check: http://localhost:${PORT}/health`);
    });
  } catch (error) {
    logger.error("Failed to start server:", error);
    process.exit(1);
  }
}

// ============================================
// GRACEFUL SHUTDOWN
// ============================================

async function gracefulShutdown(signal: string) {
  logger.info(`${signal} received, starting graceful shutdown...`);

  try {
    // Close queues
    await closeQueues();

    // Disconnect database
    const { disconnectDatabase } = await import("./config/database");
    await disconnectDatabase();

    logger.info("Graceful shutdown completed");
    process.exit(0);
  } catch (error) {
    logger.error("Error during shutdown:", error);
    process.exit(1);
  }
}

// Handle shutdown signals
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

// Handle uncaught errors
process.on("uncaughtException", (error) => {
  logger.error("Uncaught Exception:", error);
  process.exit(1);
});

process.on("unhandledRejection", (reason, promise) => {
  logger.error("Unhandled Rejection at:", promise, "reason:", reason);
  process.exit(1);
});

// Start the server
if (require.main === module) {
  startServer();
}

export default app;
