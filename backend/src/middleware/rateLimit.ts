// ============================================
// RATE LIMITING MIDDLEWARE
// ============================================

import rateLimit from "express-rate-limit";
import RedisStore from "rate-limit-redis";
import { RedisService } from "../services/redis.service";

const redis = new RedisService();
const redisClient = redis.getClient();

// General API rate limiter
export const apiLimiter = rateLimit({
  store: new RedisStore({
    client: redisClient,
    prefix: "rate:api:",
  }),
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per window
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: "Too many requests, please try again later.",
  },
});

// Strict rate limiter for sensitive endpoints
export const authLimiter = rateLimit({
  store: new RedisStore({
    client: redisClient,
    prefix: "rate:auth:",
  }),
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts
  skipSuccessfulRequests: true,
  message: {
    success: false,
    error: "Too many authentication attempts, please try again later.",
  },
});

// Order creation rate limiter
export const orderLimiter = rateLimit({
  store: new RedisStore({
    client: redisClient,
    prefix: "rate:order:",
  }),
  windowMs: 60 * 1000, // 1 minute
  max: 10, // 10 orders per minute
  keyGenerator: (req) => req.user?.id || req.ip,
  message: {
    success: false,
    error: "Too many order requests, please slow down.",
  },
});

// Payment rate limiter
export const paymentLimiter = rateLimit({
  store: new RedisStore({
    client: redisClient,
    prefix: "rate:payment:",
  }),
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20, // 20 payment requests per hour
  keyGenerator: (req) => req.user?.id || req.ip,
  message: {
    success: false,
    error: "Too many payment requests, please try again later.",
  },
});

// Admin endpoints rate limiter (more lenient)
export const adminLimiter = rateLimit({
  store: new RedisStore({
    client: redisClient,
    prefix: "rate:admin:",
  }),
  windowMs: 60 * 1000, // 1 minute
  max: 60, // 60 requests per minute
  keyGenerator: (req) => req.user?.id || req.ip,
  message: {
    success: false,
    error: "Too many admin requests, please slow down.",
  },
});

// Public endpoints (no auth required)
export const publicLimiter = rateLimit({
  store: new RedisStore({
    client: redisClient,
    prefix: "rate:public:",
  }),
  windowMs: 60 * 1000, // 1 minute
  max: 30, // 30 requests per minute
  message: {
    success: false,
    error: "Too many requests, please try again later.",
  },
});
