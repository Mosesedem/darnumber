// ============================================
// VALIDATION MIDDLEWARE
// ============================================

import { Request, Response, NextFunction } from "express";
import { z, ZodError } from "zod";

export function validateRequest(schema: z.ZodSchema) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      await schema.parseAsync(req.body);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const errors = error.errors.map((err) => ({
          field: err.path.join("."),
          message: err.message,
        }));

        return res.status(400).json({
          success: false,
          error: "Validation failed",
          details: errors,
        });
      }

      return res.status(400).json({
        success: false,
        error: "Invalid request data",
      });
    }
  };
}

export function validateQuery(schema: z.ZodSchema) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      await schema.parseAsync(req.query);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const errors = error.errors.map((err) => ({
          field: err.path.join("."),
          message: err.message,
        }));

        return res.status(400).json({
          success: false,
          error: "Query validation failed",
          details: errors,
        });
      }

      return res.status(400).json({
        success: false,
        error: "Invalid query parameters",
      });
    }
  };
}

export function validateParams(schema: z.ZodSchema) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      await schema.parseAsync(req.params);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const errors = error.errors.map((err) => ({
          field: err.path.join("."),
          message: err.message,
        }));

        return res.status(400).json({
          success: false,
          error: "Parameter validation failed",
          details: errors,
        });
      }

      return res.status(400).json({
        success: false,
        error: "Invalid parameters",
      });
    }
  };
}
