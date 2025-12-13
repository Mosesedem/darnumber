// ============================================
// LOGGER UTILITY - Winston with CloudWatch
// ============================================

import winston from "winston";
import WinstonCloudWatch from "winston-cloudwatch";

const logLevel = process.env.LOG_LEVEL || "info";

// Define log format
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json()
);

const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let metaStr = Object.keys(meta).length ? JSON.stringify(meta, null, 2) : "";
    return `${timestamp} [${level}]: ${message} ${metaStr}`;
  })
);

// Create transports array
const transports: winston.transport[] = [
  new winston.transports.Console({
    format: consoleFormat,
    level: logLevel,
  }),
];

// Add file transports for development/production
if (process.env.NODE_ENV !== "test") {
  transports.push(
    new winston.transports.File({
      filename: "logs/error.log",
      level: "error",
      format: logFormat,
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
    new winston.transports.File({
      filename: "logs/combined.log",
      format: logFormat,
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    })
  );
}

// Add CloudWatch transport for production
if (process.env.NODE_ENV === "production" && process.env.AWS_REGION) {
  const cloudwatchConfig = {
    logGroupName: process.env.CLOUDWATCH_LOG_GROUP || "/aws/sms-service",
    logStreamName: `${process.env.NODE_ENV}-${
      new Date().toISOString().split("T")[0]
    }`,
    awsRegion: process.env.AWS_REGION,
    awsAccessKeyId: process.env.AWS_ACCESS_KEY_ID,
    awsSecretKey: process.env.AWS_SECRET_ACCESS_KEY,
    messageFormatter: (logObject: any) => {
      return JSON.stringify(logObject);
    },
  };

  transports.push(new WinstonCloudWatch(cloudwatchConfig));
}

// Create logger
export const logger = winston.createLogger({
  level: logLevel,
  format: logFormat,
  defaultMeta: {
    service: "sms-service",
    environment: process.env.NODE_ENV || "development",
  },
  transports,
  exitOnError: false,
});

// Stream for Morgan HTTP logger
export const stream = {
  write: (message: string) => {
    logger.http(message.trim());
  },
};

// Helper functions for structured logging
export const loggers = {
  info: (message: string, meta?: any) => logger.info(message, meta),
  error: (message: string, meta?: any) => logger.error(message, meta),
  warn: (message: string, meta?: any) => logger.warn(message, meta),
  debug: (message: string, meta?: any) => logger.debug(message, meta),
  http: (message: string, meta?: any) => logger.http(message, meta),

  // Specific log types
  orderCreated: (orderId: string, userId: string, meta?: any) => {
    logger.info("Order created", {
      orderId,
      userId,
      type: "order",
      action: "created",
      ...meta,
    });
  },

  orderCompleted: (orderId: string, userId: string, meta?: any) => {
    logger.info("Order completed", {
      orderId,
      userId,
      type: "order",
      action: "completed",
      ...meta,
    });
  },

  paymentReceived: (userId: string, amount: number, meta?: any) => {
    logger.info("Payment received", {
      userId,
      amount,
      type: "payment",
      action: "received",
      ...meta,
    });
  },

  authAttempt: (email: string, success: boolean, meta?: any) => {
    logger.info("Authentication attempt", {
      email,
      success,
      type: "auth",
      action: "login",
      ...meta,
    });
  },

  providerError: (provider: string, error: string, meta?: any) => {
    logger.error("Provider error", {
      provider,
      error,
      type: "provider",
      action: "error",
      ...meta,
    });
  },

  apiError: (endpoint: string, error: string, meta?: any) => {
    logger.error("API error", {
      endpoint,
      error,
      type: "api",
      action: "error",
      ...meta,
    });
  },
};

export default logger;
