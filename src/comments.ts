// src/comments.ts
import { NextFunction, Request, Response } from "express";
import { z } from "zod";
import { prisma, logger } from "./config";

// Validation schemas
const createCommentSchema = z.object({
  content: z.string().min(1).max(1000),
  postId: z.string().uuid(),
});

const updateCommentSchema = z.object({
  content: z.string().min(1).max(1000),
});

export const paginationSchema = z
  .object({
    page: z
      .string()
      .regex(/^\d+$/)
      .default("1")
      .transform((val) => parseInt(val)),

    limit: z
      .string()
      .regex(/^\d+$/)
      .default("10")
      .transform((val) => parseInt(val))
      .refine((val) => val >= 1 && val <= 100, {
        message: "Limit must be between 1 and 100",
      }),

    // Optional sort direction
    sortBy: z.enum(["asc", "desc"]).optional().default("desc"),

    // Optional search query
    search: z.string().optional(),
  })
  .refine(
    (data) => {
      return data.page > 0;
    },
    {
      message: "Page must be greater than 0",
      path: ["page"],
    }
  );

// Type inference from the schema
export type PaginationQuery = z.infer<typeof paginationSchema>;

// Comment handlers
export const commentHandlers = {
  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { content, postId } = createCommentSchema.parse(req.body);

      const post = await prisma.post.findUnique({
        where: { id: postId },
      });

      if (!post) {
        res.status(404).json({ error: "Post not found" });
        return;
      }

      const comment = await prisma.comment.create({
        data: {
          content,
          postId,
          userId: req.user!.id,
        },
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      });

      logger.info(`Comment created: ${comment.id}`);
      res.status(201).json(comment);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: error.errors });
        return;
      }
      next(error);
    }
  },

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const { content } = updateCommentSchema.parse(req.body);

      const comment = await prisma.comment.findUnique({
        where: { id },
      });

      if (!comment) {
        res.status(404).json({ error: "Comment not found" });
        return;
      }

      if (comment.userId !== req.user!.id && req.user!.role !== "admin") {
        res.status(403).json({ error: "Not authorized" });
        return;
      }

      const updatedComment = await prisma.comment.update({
        where: { id },
        data: { content },
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      });

      res.json(updatedComment);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: error.errors });
        return;
      }
      next(error);
    }
  },

  async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;

      const comment = await prisma.comment.findUnique({
        where: { id },
      });

      if (!comment) {
        res.status(404).json({ error: "Comment not found" });
        return;
      }

      if (comment.userId !== req.user!.id && req.user!.role !== "admin") {
        res.status(403).json({ error: "Not authorized" });
        return;
      }

      await prisma.comment.delete({ where: { id } });

      logger.info(`Comment deleted: ${id}`);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  },

  async getByPost(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { postId } = req.params;
      const { page, limit } = paginationSchema.parse(req.query);
      const skip = (page - 1) * limit; // No parseInt needed

      const post = await prisma.post.findUnique({
        where: { id: postId },
      });

      if (!post) {
        res.status(404).json({ error: "Post not found" });
        return;
      }

      const [comments, total] = await Promise.all([
        prisma.comment.findMany({
          where: { postId },
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              },
            },
          },
          orderBy: { createdAt: "desc" },
          skip,
          take: limit, // No parseInt needed
        }),
        prisma.comment.count({ where: { postId } }),
      ]);

      res.json({
        data: comments,
        pagination: {
          page, // Already a number
          limit, // Already a number
          total,
          pages: Math.ceil(total / limit),
        },
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: error.errors });
        return;
      }
      next(error);
    }
  },
};

// Rate limit configurations for comments
export const commentRateLimits = {
  create: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 30, // 30 comments per window
  },
  update: {
    windowMs: 15 * 60 * 1000,
    max: 20,
  },
};
