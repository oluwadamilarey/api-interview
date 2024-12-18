// src/routes.ts
import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import swaggerUi from "swagger-ui-express";
import { authenticate, requireAdmin, authHandlers } from "./auth";
import { postHandlers, postRateLimits } from "./posts";
import { commentHandlers, commentRateLimits } from "./comments";
import { userDocs, adminDocs } from "./swagger";
import { rateLimitConfig } from "./config";

const router = Router();

// Create specific rate limiters
const createPostLimiter = rateLimit(postRateLimits.create);
const updatePostLimiter = rateLimit(postRateLimits.update);
const createCommentLimiter = rateLimit(commentRateLimits.create);
const updateCommentLimiter = rateLimit(commentRateLimits.update);
const authLimiter = rateLimit({
  ...rateLimitConfig,
  max: 5, // Stricter limit for auth routes
  windowMs: 15 * 60 * 1000, // 15 minutes
});

// Auth routes
router.post("/auth/signup", authLimiter, authHandlers.signup);
router.post("/auth/login", authLimiter, authHandlers.login);
router.post(
  "/auth/admin",
  authenticate,
  requireAdmin,
  authLimiter,
  authHandlers.createAdmin
);

// Post routes
router.post("/posts", authenticate, createPostLimiter, postHandlers.create);

router.get("/posts", postHandlers.getMany);

router.get("/posts/:id", postHandlers.getOne);

router.patch(
  "/posts/:id",
  authenticate,
  updatePostLimiter,
  postHandlers.update
);

router.delete("/posts/:id", authenticate, postHandlers.delete);

// Comment routes
router.post(
  "/posts/:postId/comments",
  authenticate,
  createCommentLimiter,
  commentHandlers.create
);

router.get("/posts/:postId/comments", commentHandlers.getByPost);

router.patch(
  "/comments/:id",
  authenticate,
  updateCommentLimiter,
  commentHandlers.update
);

router.delete("/comments/:id", authenticate, commentHandlers.delete);

// User documentation route
router.use("/docs/user", swaggerUi.serve);
router.get("/docs/user", swaggerUi.setup(userDocs));

// Admin documentation route (protected)
router.use("/docs/admin", swaggerUi.serve);
router.get(
  "/docs/admin",
  authenticate,
  requireAdmin,
  swaggerUi.setup(adminDocs)
);

// Health check
router.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

export { router };
