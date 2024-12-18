// src/users.ts
import { Request, Response } from "express";
import { z } from "zod";
import bcrypt from "bcrypt";
import { prisma, logger, CustomError } from "./config";
import { User, SafeUser } from "./types";
import { Prisma } from "@prisma/client";

// Validation schemas
const updateProfileSchema = z
  .object({
    firstName: z.string().min(2).max(50).optional(),
    lastName: z.string().min(2).max(50).optional(),
    country: z.string().min(2).max(50).optional(),
    currentPassword: z.string().min(8).optional(),
    newPassword: z.string().min(8).optional(),
  })
  .refine(
    (data) => {
      if (data.newPassword && !data.currentPassword) {
        return false;
      }
      return true;
    },
    {
      message: "Current password is required when setting new password",
      path: ["currentPassword"],
    }
  );

const querySchema = z.object({
  page: z.string().regex(/^\d+$/).default("1"),
  limit: z.string().regex(/^\d+$/).default("10"),
  search: z.string().optional(),
});

export const userHandlers = {
  // Get profile of authenticated user
  async getProfile(req: Request, res: Response) {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        country: true,
        role: true,
        createdAt: true,
        _count: {
          select: {
            posts: true,
            comments: true,
          },
        },
      },
    });

    if (!user) {
      throw new CustomError(404, "User not found");
    }

    res.json(user);
  },

  // Update user profile
  async updateProfile(req: Request, res: Response) {
    try {
      const updates = updateProfileSchema.parse(req.body);
      const userId = req.user!.id;

      // Handle password update if requested
      if (updates.newPassword) {
        const user = await prisma.user.findUnique({
          where: { id: userId },
          select: { password: true },
        });

        if (
          !user ||
          !(await bcrypt.compare(updates.currentPassword!, user.password))
        ) {
          throw new CustomError(400, "Current password is incorrect");
        }

        updates.newPassword = await bcrypt.hash(updates.newPassword, 12);
      }

      // Remove password fields from updates
      const { currentPassword, newPassword, ...profileUpdates } = updates;

      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: {
          ...profileUpdates,
          ...(newPassword && { password: newPassword }),
        },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          country: true,
          role: true,
          createdAt: true,
        },
      });

      logger.info(`Profile updated for user: ${userId}`);
      res.json(updatedUser);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      throw error;
    }
  },

  // Admin: Get all users with pagination and search
  async getUsers(req: Request, res: Response) {
    try {
      const { page, limit, search } = querySchema.parse(req.query);
      const skip = (parseInt(page) - 1) * parseInt(limit);

      const whereClause: Prisma.UserWhereInput = search
        ? {
            OR: [
              {
                email: {
                  contains: search,
                  mode: Prisma.QueryMode.insensitive,
                },
              },
              {
                firstName: {
                  contains: search,
                  mode: Prisma.QueryMode.insensitive,
                },
              },
              {
                lastName: {
                  contains: search,
                  mode: Prisma.QueryMode.insensitive,
                },
              },
            ],
          }
        : {};

      const [users, total] = await Promise.all([
        prisma.user.findMany({
          where: whereClause,
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            country: true,
            role: true,
            createdAt: true,
            _count: {
              select: {
                posts: true,
                comments: true,
              },
            },
          },
          orderBy: { createdAt: "desc" },
          skip,
          take: parseInt(limit),
        }),
        prisma.user.count({ where: whereClause }),
      ]);

      res.json({
        data: users,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit)),
        },
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      throw error;
    }
  },

  // Admin: Update user role
  async updateUserRole(req: Request, res: Response) {
    const { id } = req.params;
    const { role } = z
      .object({
        role: z.enum(["user", "admin"]),
      })
      .parse(req.body);

    // Prevent self-role update
    if (id === req.user!.id) {
      throw new CustomError(400, "Cannot update your own role");
    }

    const updatedUser = await prisma.user.update({
      where: { id },
      data: { role },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
      },
    });

    logger.info(
      `Role updated for user ${id} to ${role} by admin ${req.user!.id}`
    );
    res.json(updatedUser);
  },

  // Admin: Delete user
  async deleteUser(req: Request, res: Response) {
    const { id } = req.params;

    // Prevent self-deletion
    if (id === req.user!.id) {
      throw new CustomError(400, "Cannot delete your own account");
    }

    // Delete user and all related data in a transaction
    await prisma.$transaction([
      prisma.comment.deleteMany({ where: { userId: id } }),
      prisma.post.deleteMany({ where: { userId: id } }),
      prisma.user.delete({ where: { id } }),
    ]);

    logger.info(`User ${id} deleted by admin ${req.user!.id}`);
    res.status(204).send();
  },
};

// Rate limit configurations
export const userRateLimits = {
  profile: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 30, // 30 requests per window
  },
  admin: {
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 100, // 100 requests per hour
  },
};
