// src/types.ts
import { z } from "zod";
import { NextFunction, Request, Response } from "express-serve-static-core";

// User types
export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  country: string;
  role: UserRole;
  createdAt: Date;
  updatedAt: Date;
}

export class CustomError extends Error {
  constructor(public statusCode: number, message: string) {
    super(message);
    this.name = "CustomError";

    // Maintain proper stack trace (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, CustomError);
    }
  }
}

export type ApplicationError = CustomError | ValidationError;

// Update ApiError to potentially include status code
export interface ApiError {
  error: string;
  details?: unknown;
  code?: string;
  statusCode?: number;
}

export type UserRole = "user" | "admin";

export interface SafeUser extends Omit<User, "password"> {}

// Post types
export interface Post {
  id: string;
  title: string;
  content: string;
  userId: string;
  user?: SafeUser;
  comments?: Comment[];
  _count?: {
    comments: number;
  };
  createdAt: Date;
  updatedAt: Date;
}

// Comment types
export interface Comment {
  id: string;
  content: string;
  postId: string;
  userId: string;
  user?: SafeUser;
  createdAt: Date;
  updatedAt: Date;
}

// Request types
export interface AuthenticatedRequest extends Request {
  user: {
    id: string;
    email: string;
    role: UserRole;
  };
}

// Response types
export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

// Error types
export interface ApiError {
  error: string;
  details?: unknown;
  code?: string;
}

// Validation schemas
export const paginationSchema = z.object({
  page: z.string().regex(/^\d+$/).default("1"),
  limit: z.string().regex(/^\d+$/).default("10"),
});

// Utility types
export type WithPagination = {
  page?: string;
  limit?: string;
};

export type RequestQuery<T> = T & WithPagination;

// Config types
export interface JwtPayload {
  userId: string;
  email: string;
  role: UserRole;
}

export interface RateLimitConfig {
  windowMs: number;
  max: number;
}

// Declare global types
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        role: UserRole;
      };
    }
  }
}

// Environment variables type
export interface Env {
  NODE_ENV: "development" | "test" | "production";
  PORT: string;
  DATABASE_URL: string;
  JWT_SECRET: string;
  JWT_EXPIRES_IN: string;
  RATE_LIMIT_WINDOW_MS: string;
  RATE_LIMIT_MAX: string;
  LOG_LEVEL: "error" | "warn" | "info" | "debug";
}

// Service response types
export type ServiceResponse<T> =
  | {
      success: true;
      data: T;
    }
  | {
      success: false;
      error: ApiError;
    };

// Repository types
export interface Repository<T> {
  create(data: Partial<T>): Promise<T>;
  findById(id: string): Promise<T | null>;
  findMany(params: RequestQuery<unknown>): Promise<PaginatedResponse<T>>;
  update(id: string, data: Partial<T>): Promise<T>;
  delete(id: string): Promise<void>;
}

// Middleware types
export type MiddlewareFunction = (
  req: Request,
  res: Response,
  next: NextFunction
) => Promise<void> | void;

// Handler types
export type RequestHandler<T = any> = (
  req: Request,
  res: Response<T>
) => Promise<void>;

// Validation Error type
export interface ValidationError {
  field: string;
  message: string;
  code: string;
}
