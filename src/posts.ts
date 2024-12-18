// src/posts.ts
import { NextFunction, Request, Response } from "express";
import { z } from "zod";
import { prisma, logger, CustomError } from "./config";

// Validation schemas
const createPostSchema = z.object({
  title: z.string().min(1).max(200),
  content: z.string().min(1).max(10000),
});

const updatePostSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  content: z.string().min(1).max(10000).optional(),
});

const querySchema = z.object({
  page: z.string().regex(/^\d+$/).default("1"),
  limit: z.string().regex(/^\d+$/).default("10"),
  userId: z.string().uuid().optional(),
});

export const postHandlers = {
  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { title, content } = createPostSchema.parse(req.body);

      const post = await prisma.post.create({
        data: {
          title,
          content,
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
          _count: {
            select: { comments: true },
          },
        },
      });

      logger.info(`Post created: ${post.id}`);
      res.status(201).json(post);
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
      const updates = updatePostSchema.parse(req.body);

      const post = await prisma.post.findUnique({
        where: { id },
      });

      if (!post) {
        res.status(404).json({ error: "Post not found" });
        return;
      }

      if (post.userId !== req.user!.id && req.user!.role !== "admin") {
        res.status(403).json({ error: "Not authorized to update this post" });
        return;
      }

      const updatedPost = await prisma.post.update({
        where: { id },
        data: updates,
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
          _count: {
            select: { comments: true },
          },
        },
      });

      res.json(updatedPost);
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

      const post = await prisma.post.findUnique({
        where: { id },
      });

      if (!post) {
        res.status(404).json({ error: "Post not found" });
        return;
      }

      if (post.userId !== req.user!.id && req.user!.role !== "admin") {
        res.status(403).json({ error: "Not authorized to delete this post" });
        return;
      }

      await prisma.$transaction([
        prisma.comment.deleteMany({ where: { postId: id } }),
        prisma.post.delete({ where: { id } }),
      ]);

      res.status(204).send();
    } catch (error) {
      next(error);
    }
  },

  async getOne(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;

      const post = await prisma.post.findUnique({
        where: { id },
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
          _count: {
            select: { comments: true },
          },
        },
      });

      if (!post) {
        res.status(404).json({ error: "Post not found" });
        return;
      }

      res.json(post);
    } catch (error) {
      next(error);
    }
  },

  async getMany(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { page, limit, userId } = querySchema.parse(req.query);
      const skip = (parseInt(page) - 1) * parseInt(limit);

      const whereClause = userId ? { userId } : {};

      const [posts, total] = await Promise.all([
        prisma.post.findMany({
          where: whereClause,
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              },
            },
            _count: {
              select: { comments: true },
            },
          },
          orderBy: { createdAt: "desc" },
          skip,
          take: parseInt(limit),
        }),
        prisma.post.count({ where: whereClause }),
      ]);

      res.json({
        data: posts,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit)),
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

// Rate limit configurations for posts
export const postRateLimits = {
  create: {
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 10, // 10 posts per hour
  },
  update: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 20,
  },
};
