// src/utils.ts
import { Request } from 'express';
import { z } from 'zod';
import bcrypt from 'bcrypt';
import { PaginatedResponse, ApiError } from './types';
import { CustomError } from './config';

/**
 * Password utilities
 */
export const passwordUtils = {
  async hash(password: string): Promise<string> {
    return bcrypt.hash(password, 12);
  },

  async compare(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  },

  validate(password: string): boolean {
    // At least 8 characters, 1 uppercase, 1 lowercase, 1 number
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
    return passwordRegex.test(password);
  }
};

/**
 * Pagination utilities
 */
export const paginationUtils = {
  parsePaginationParams(query: Request['query']) {
    const schema = z.object({
      page: z.string().regex(/^\d+$/).default('1'),
      limit: z.string().regex(/^\d+$/).default('10'),
    });

    const { page, limit } = schema.parse(query);
    return {
      skip: (parseInt(page) - 1) * parseInt(limit),
      take: parseInt(limit),
      page: parseInt(page),
      limit: parseInt(limit),
    };
  },

  createPaginatedResponse<T>(
    data: T[],
    total: number,
    page: number,
    limit: number
  ): PaginatedResponse<T> {
    return {
      data,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }
};

/**
 * Error handling utilities
 */
export const errorUtils = {
  isCustomError(error: unknown): error is CustomError {
    return error instanceof CustomError;
  },

  createApiError(message: string, code?: string, details?: unknown): ApiError {
    return {
      error: message,
      ...(code && { code }),
      ...(typeof details === 'object' && details !== null && { details }),
    };
  },

  handleZodError(error: z.ZodError): ApiError {
    return {
      error: 'Validation error',
      details: error.errors.map(err => ({
        field: err.path.join('.'),
        message: err.message,
      })),
    };
  }
};

/**
 * String utilities
 */
export const stringUtils = {
  slugify(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '');
  },

  truncate(text: string, length: number): string {
    if (text.length <= length) return text;
    return text.slice(0, length) + '...';
  },

  sanitize(text: string): string {
    return text
      .replace(/[<>]/g, '')
      .trim();
  }
};

/**
 * Date utilities
 */
export const dateUtils = {
  isValidDate(date: unknown): date is Date {
    return date instanceof Date && !isNaN(date.getTime());
  },

  formatDate(date: Date): string {
    return date.toISOString();
  },

  addDays(date: Date, days: number): Date {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
  }
};

/**
 * Object utilities
 */
export const objectUtils = {
  removeUndefined<T extends object>(obj: T): Partial<T> {
    return Object.fromEntries(
      Object.entries(obj).filter(([_, v]) => v !== undefined)
    ) as Partial<T>;
  },

  pick<T extends object, K extends keyof T>(
    obj: T,
    keys: K[]
  ): Pick<T, K> {
    const result = {} as Pick<T, K>;
    keys.forEach((key) => {
      if (key in obj) {
        result[key] = obj[key];
      }
    });
    return result;
  },

  omit<T extends object, K extends keyof T>(
    obj: T,
    keys: K[]
  ): Omit<T, K> {
    const result = { ...obj };
    keys.forEach((key) => delete result[key]);
    return result;
  }
};

/**
 * Validation utilities
 */
export const validationUtils = {
  isEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  },

  isUUID(str: string): boolean {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(str);
  },

  isSafeString(str: string): boolean {
    const safeRegex = /^[a-zA-Z0-9\s-_.,!?]+$/;
    return safeRegex.test(str);
  }
};

/**
 * Type guard utilities
 */
export const typeGuards = {
  isNonNullable<T>(value: T): value is NonNullable<T> {
    return value !== null && value !== undefined;
  },

  isString(value: unknown): value is string {
    return typeof value === 'string';
  },

  isNumber(value: unknown): value is number {
    return typeof value === 'number' && !isNaN(value);
  }
};