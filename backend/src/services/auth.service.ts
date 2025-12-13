// ============================================
// AUTHENTICATION SERVICE
// ============================================

import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { PrismaClient } from "@prisma/client";
import { RedisService } from "./redis.service";
import crypto from "crypto";

const prisma = new PrismaClient();
const redis = new RedisService();

interface RegisterInput {
  email: string;
  password: string;
  userName: string;
  phone?: string;
  country?: string;
  referralCode?: string;
}

interface LoginInput {
  email: string;
  password: string;
  deviceInfo?: any;
  ipAddress?: string;
  userAgent?: string;
}

export class AuthService {
  // ============================================
  // PASSWORD MANAGEMENT
  // ============================================

  async hashPassword(password: string): Promise<string> {
    return await bcrypt.hash(password, 12);
  }

  async comparePassword(
    password: string,
    hashedPassword: string
  ): Promise<boolean> {
    return await bcrypt.compare(password, hashedPassword);
  }

  // ============================================
  // TOKEN GENERATION
  // ============================================

  generateAccessToken(userId: string, email: string, role: string): string {
    return jwt.sign({ userId, email, role }, process.env.JWT_SECRET!, {
      expiresIn: "15m",
    });
  }

  generateRefreshToken(userId: string): string {
    return jwt.sign({ userId }, process.env.JWT_REFRESH_SECRET!, {
      expiresIn: "7d",
    });
  }

  verifyAccessToken(token: string): any {
    return jwt.verify(token, process.env.JWT_SECRET!);
  }

  verifyRefreshToken(token: string): any {
    return jwt.verify(token, process.env.JWT_REFRESH_SECRET!);
  }

  // ============================================
  // REGISTRATION
  // ============================================

  async register(input: RegisterInput) {
    const { email, password, userName, phone, country, referralCode } = input;

    // Check if user already exists
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [{ email }, ...(phone ? [{ phone }] : [])],
      },
    });

    if (existingUser) {
      throw new Error("User already exists with this email or phone");
    }

    // Hash password
    const hashedPassword = await this.hashPassword(password);

    // Generate unique referral code for new user
    const userReferralCode = await this.generateUniqueReferralCode(userName);

    // Handle referrer if referral code provided
    let referrerId: string | undefined;
    if (referralCode) {
      const referrer = await prisma.user.findUnique({
        where: { referralCode },
      });

      if (referrer) {
        referrerId = referrer.id;
      }
    }

    // Create user
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        userName,
        phone,
        country,
        referralCode: userReferralCode,
        referredBy: referrerId,
        status: "PENDING_VERIFICATION",
        role: "USER",
      },
      select: {
        id: true,
        email: true,
        userName: true,
        role: true,
        status: true,
        referralCode: true,
      },
    });

    // Create referral record if applicable
    if (referrerId) {
      await prisma.referral.create({
        data: {
          referrerId,
          referredId: user.id,
          referrerReward: 5.0, // $5 reward for referrer
          referredReward: 2.0, // $2 reward for referred user
          rewardPaid: false,
        },
      });
    }

    // Send verification email
    // TODO: Implement email verification

    return {
      user,
      message: "Registration successful. Please verify your email.",
    };
  }

  // ============================================
  // LOGIN
  // ============================================

  async login(input: LoginInput) {
    const { email, password, deviceInfo, ipAddress, userAgent } = input;

    // Find user
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      throw new Error("Invalid credentials");
    }

    // Check password
    const isValidPassword = await this.comparePassword(password, user.password);

    if (!isValidPassword) {
      throw new Error("Invalid credentials");
    }

    // Check account status
    if (user.status === "BANNED") {
      throw new Error("Account has been banned");
    }

    if (user.status === "SUSPENDED") {
      throw new Error("Account is suspended");
    }

    // Generate tokens
    const accessToken = this.generateAccessToken(
      user.id,
      user.email,
      user.role
    );
    const refreshToken = this.generateRefreshToken(user.id);

    // Create session
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days

    await prisma.session.create({
      data: {
        userId: user.id,
        token: accessToken,
        refreshToken,
        deviceInfo,
        ipAddress,
        userAgent,
        expiresAt,
      },
    });

    // Update last login
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    // Cache session
    await redis.setSession(
      accessToken,
      {
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
        },
      },
      900 // 15 minutes
    );

    // Log activity
    await prisma.activityLog.create({
      data: {
        userId: user.id,
        action: "USER_LOGIN",
        resource: "auth",
        ipAddress,
        userAgent,
        metadata: { deviceInfo },
      },
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        userName: user.userName,
        role: user.role,
        status: user.status,
        balance: user.balance,
        currency: user.currency,
      },
      accessToken,
      refreshToken,
    };
  }

  // ============================================
  // LOGOUT
  // ============================================

  async logout(token: string, userId: string) {
    // Delete session from database
    await prisma.session.deleteMany({
      where: {
        userId,
        token,
      },
    });

    // Remove from cache
    await redis.deleteSession(token);

    // Log activity
    await prisma.activityLog.create({
      data: {
        userId,
        action: "USER_LOGOUT",
        resource: "auth",
      },
    });

    return { message: "Logged out successfully" };
  }

  // ============================================
  // REFRESH TOKEN
  // ============================================

  async refreshToken(refreshToken: string) {
    try {
      // Verify refresh token
      const decoded = this.verifyRefreshToken(refreshToken);

      // Find session
      const session = await prisma.session.findUnique({
        where: { refreshToken },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              role: true,
              status: true,
            },
          },
        },
      });

      if (!session || session.expiresAt < new Date()) {
        throw new Error("Invalid or expired refresh token");
      }

      if (session.user.status !== "ACTIVE") {
        throw new Error("Account is not active");
      }

      // Generate new access token
      const accessToken = this.generateAccessToken(
        session.user.id,
        session.user.email,
        session.user.role
      );

      // Update session
      await prisma.session.update({
        where: { id: session.id },
        data: { token: accessToken },
      });

      // Cache new session
      await redis.setSession(
        accessToken,
        {
          user: {
            id: session.user.id,
            email: session.user.email,
            role: session.user.role,
          },
        },
        900
      );

      return {
        accessToken,
        refreshToken: session.refreshToken,
      };
    } catch (error) {
      throw new Error("Invalid refresh token");
    }
  }

  // ============================================
  // PASSWORD RESET
  // ============================================

  async requestPasswordReset(email: string) {
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      // Don't reveal if user exists
      return { message: "If email exists, reset link has been sent" };
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString("hex");
    const hashedToken = await this.hashPassword(resetToken);

    // Store in database (you might want a separate table for this)
    await redis.set(
      `password-reset:${user.id}`,
      hashedToken,
      3600 // 1 hour
    );

    // Send email with reset link
    // TODO: Implement email sending
    // const resetLink = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}&id=${user.id}`;

    return { message: "If email exists, reset link has been sent" };
  }

  async resetPassword(userId: string, token: string, newPassword: string) {
    // Get stored token
    const storedToken = await redis.get(`password-reset:${userId}`);

    if (!storedToken) {
      throw new Error("Invalid or expired reset token");
    }

    // Verify token
    const isValid = await this.comparePassword(token, storedToken);

    if (!isValid) {
      throw new Error("Invalid reset token");
    }

    // Hash new password
    const hashedPassword = await this.hashPassword(newPassword);

    // Update password
    await prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword },
    });

    // Delete reset token
    await redis.del(`password-reset:${userId}`);

    // Invalidate all sessions
    await prisma.session.deleteMany({
      where: { userId },
    });

    // Log activity
    await prisma.activityLog.create({
      data: {
        userId,
        action: "PASSWORD_RESET",
        resource: "auth",
      },
    });

    return { message: "Password reset successful" };
  }

  // ============================================
  // EMAIL VERIFICATION
  // ============================================

  async sendVerificationEmail(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new Error("User not found");
    }

    if (user.emailVerified) {
      throw new Error("Email already verified");
    }

    // Generate verification token
    const verificationToken = crypto.randomBytes(32).toString("hex");

    // Store in Redis
    await redis.set(
      `email-verify:${userId}`,
      verificationToken,
      86400 // 24 hours
    );

    // Send email
    // TODO: Implement email sending
    // const verifyLink = `${process.env.FRONTEND_URL}/verify-email?token=${verificationToken}&id=${userId}`;

    return { message: "Verification email sent" };
  }

  async verifyEmail(userId: string, token: string) {
    const storedToken = await redis.get(`email-verify:${userId}`);

    if (!storedToken || storedToken !== token) {
      throw new Error("Invalid or expired verification token");
    }

    // Update user
    await prisma.user.update({
      where: { id: userId },
      data: {
        emailVerified: true,
        status: "ACTIVE",
      },
    });

    // Delete verification token
    await redis.del(`email-verify:${userId}`);

    // Log activity
    await prisma.activityLog.create({
      data: {
        userId,
        action: "EMAIL_VERIFIED",
        resource: "auth",
      },
    });

    return { message: "Email verified successfully" };
  }

  // ============================================
  // UTILITIES
  // ============================================

  private async generateUniqueReferralCode(userName: string): Promise<string> {
    const baseCode = userName
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "")
      .substring(0, 8);
    let code = baseCode + Math.random().toString(36).substring(2, 6);

    let attempts = 0;
    while (attempts < 10) {
      const existing = await prisma.user.findUnique({
        where: { referralCode: code },
      });

      if (!existing) {
        return code;
      }

      code = baseCode + Math.random().toString(36).substring(2, 6);
      attempts++;
    }

    // Fallback to completely random code
    return crypto.randomBytes(6).toString("hex");
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string
  ) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new Error("User not found");
    }

    // Verify current password
    const isValid = await this.comparePassword(currentPassword, user.password);

    if (!isValid) {
      throw new Error("Current password is incorrect");
    }

    // Hash new password
    const hashedPassword = await this.hashPassword(newPassword);

    // Update password
    await prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword },
    });

    // Log activity
    await prisma.activityLog.create({
      data: {
        userId,
        action: "PASSWORD_CHANGED",
        resource: "auth",
      },
    });

    return { message: "Password changed successfully" };
  }
}
