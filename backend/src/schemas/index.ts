// ============================================
// VALIDATION SCHEMAS - Zod
// ============================================

import { z } from "zod";

// ============================================
// AUTH SCHEMAS
// ============================================

export const registerSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
      "Password must contain uppercase, lowercase, and number"
    ),
  userName: z
    .string()
    .min(3, "Username must be at least 3 characters")
    .max(30, "Username must not exceed 30 characters")
    .regex(
      /^[a-zA-Z0-9_]+$/,
      "Username can only contain letters, numbers, and underscores"
    ),
  phone: z.string().optional(),
  country: z.string().length(2, "Country code must be 2 characters").optional(),
  referralCode: z.string().optional(),
});

export const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, "Refresh token is required"),
});

export const resetPasswordRequestSchema = z.object({
  email: z.string().email("Invalid email address"),
});

export const resetPasswordSchema = z.object({
  userId: z.string().cuid(),
  token: z.string().min(1, "Token is required"),
  newPassword: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
      "Password must contain uppercase, lowercase, and number"
    ),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
      "Password must contain uppercase, lowercase, and number"
    ),
});

// ============================================
// ORDER SCHEMAS
// ============================================

export const createOrderSchema = z.object({
  serviceCode: z.string().min(1, "Service code is required").max(50),
  country: z.string().length(2, "Country code must be 2 characters"),
  provider: z.string().optional(),
});

export const orderIdSchema = z.object({
  orderId: z.string().cuid("Invalid order ID"),
});

// ============================================
// PAYMENT SCHEMAS
// ============================================

export const createPaymentIntentSchema = z.object({
  amount: z
    .number()
    .positive("Amount must be positive")
    .min(5, "Minimum deposit is $5")
    .max(10000, "Maximum deposit is $10,000"),
  currency: z.string().length(3).default("USD"),
});

export const withdrawalRequestSchema = z.object({
  amount: z
    .number()
    .positive("Amount must be positive")
    .min(10, "Minimum withdrawal is $10"),
  bankDetails: z.object({
    accountNumber: z.string().min(1, "Account number is required"),
    bankName: z.string().min(1, "Bank name is required"),
    accountName: z.string().min(1, "Account name is required"),
    routingNumber: z.string().optional(),
    swiftCode: z.string().optional(),
  }),
});

// ============================================
// ADMIN SCHEMAS
// ============================================

export const updateUserSchema = z.object({
  status: z
    .enum(["ACTIVE", "SUSPENDED", "BANNED", "PENDING_VERIFICATION"])
    .optional(),
  balance: z.number().optional(),
  role: z.enum(["USER", "ADMIN", "SUPER_ADMIN"]).optional(),
});

export const adjustBalanceSchema = z.object({
  amount: z.number().refine((val) => val !== 0, "Amount cannot be zero"),
  reason: z.string().min(5, "Reason must be at least 5 characters"),
});

export const createPricingRuleSchema = z.object({
  serviceCode: z.string().optional(),
  country: z.string().length(2).optional(),
  profitType: z.enum(["PERCENTAGE", "FIXED"]),
  profitValue: z.number().positive("Profit value must be positive"),
  priority: z.number().int().min(0).default(0),
});

export const updatePricingRuleSchema = z.object({
  profitType: z.enum(["PERCENTAGE", "FIXED"]).optional(),
  profitValue: z.number().positive("Profit value must be positive").optional(),
  priority: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
});

export const updateProviderSchema = z.object({
  isActive: z.boolean().optional(),
  priority: z.number().int().min(0).optional(),
  apiKey: z.string().optional(),
  rateLimit: z.number().int().positive().optional(),
});

// ============================================
// QUERY SCHEMAS
// ============================================

export const paginationSchema = z.object({
  page: z
    .string()
    .transform(Number)
    .pipe(z.number().int().positive())
    .default("1"),
  limit: z
    .string()
    .transform(Number)
    .pipe(z.number().int().positive().max(100))
    .default("20"),
});

export const dateRangeSchema = z.object({
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});

export const orderFilterSchema = paginationSchema.extend({
  status: z
    .enum([
      "PENDING",
      "WAITING_SMS",
      "COMPLETED",
      "CANCELLED",
      "EXPIRED",
      "FAILED",
      "REFUNDED",
    ])
    .optional(),
  providerId: z.string().cuid().optional(),
  userId: z.string().cuid().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});

export const userFilterSchema = paginationSchema.extend({
  search: z.string().optional(),
  status: z
    .enum(["ACTIVE", "SUSPENDED", "BANNED", "PENDING_VERIFICATION"])
    .optional(),
});

export const activityLogFilterSchema = paginationSchema.extend({
  userId: z.string().cuid().optional(),
  action: z.string().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});

export const systemLogFilterSchema = paginationSchema.extend({
  level: z.enum(["DEBUG", "INFO", "WARN", "ERROR", "FATAL"]).optional(),
  service: z.string().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});

// ============================================
// USER UPDATE SCHEMAS
// ============================================

export const updateProfileSchema = z.object({
  userName: z
    .string()
    .min(3, "Username must be at least 3 characters")
    .max(30, "Username must not exceed 30 characters")
    .regex(
      /^[a-zA-Z0-9_]+$/,
      "Username can only contain letters, numbers, and underscores"
    )
    .optional(),
  phone: z.string().optional(),
  country: z.string().length(2).optional(),
});

export const updateBankDetailsSchema = z.object({
  bankAccount: z.string().min(1, "Bank account is required"),
  accountNumber: z.string().min(1, "Account number is required"),
  bankName: z.string().min(1, "Bank name is required"),
});
