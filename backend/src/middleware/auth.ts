// ============================================
// AUTHENTICATION MIDDLEWARE
// ============================================

import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { PrismaClient } from "@prisma/client";
import { RedisService } from "../services/redis.service";

const prisma = new PrismaClient();
const redis = new RedisService();

interface JWTPayload {
  userId: string;
  email: string;
  role: string;
}

declare global {
  namespace Express {
    interface Request {
      user: {
        id: string;
        email: string;
        role: string;
      };
    }
  }
}

export async function authenticate(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        error: "No token provided",
      });
    }

    const token = authHeader.substring(7);

    // Check if token is in cache first
    const cachedSession = await redis.getSession(token);

    if (cachedSession) {
      req.user = cachedSession.user;
      return next();
    }

    // Verify JWT
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as JWTPayload;

    // Check if session exists in database
    const session = await prisma.session.findUnique({
      where: { token },
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
      return res.status(401).json({
        success: false,
        error: "Token expired or invalid",
      });
    }

    if (session.user.status !== "ACTIVE") {
      return res.status(403).json({
        success: false,
        error: "Account is not active",
      });
    }

    // Cache session
    await redis.setSession(
      token,
      {
        user: {
          id: session.user.id,
          email: session.user.email,
          role: session.user.role,
        },
      },
      900 // 15 minutes
    );

    req.user = {
      id: session.user.id,
      email: session.user.email,
      role: session.user.role,
    };

    next();
  } catch (error) {
    console.error("Auth error:", error);
    return res.status(401).json({
      success: false,
      error: "Invalid token",
    });
  }
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (req.user.role !== "ADMIN" && req.user.role !== "SUPER_ADMIN") {
    return res.status(403).json({
      success: false,
      error: "Admin access required",
    });
  }
  next();
}

export function requireSuperAdmin(
  req: Request,
  res: Response,
  next: NextFunction
) {
  if (req.user.role !== "SUPER_ADMIN") {
    return res.status(403).json({
      success: false,
      error: "Super admin access required",
    });
  }
  next();
}
