// tests/setup.ts
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { vi, expect } from "vitest";
import { app } from "../src/app";
import { prisma, jwtConfig } from "../src/config";
import supertest from "supertest";

export const testApi = supertest(app);

// Mock logger to prevent console noise during tests
vi.mock("../src/config", async () => {
  const actual = await vi.importActual("../src/config");
  return {
    ...actual,
    logger: {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
    },
  };
});

// Test data creation helpers
export const testHelpers = {
  async createUser(
    data: {
      email?: string;
      password?: string;
      firstName?: string;
      lastName?: string;
      role?: "user" | "admin";
    } = {}
  ) {
    const hashedPassword = await bcrypt.hash(
      data.password || "password123",
      12
    );

    return prisma.user.create({
      data: {
        email: data.email || `test${Date.now()}@example.com`,
        password: hashedPassword,
        firstName: data.firstName || "Test",
        lastName: data.lastName || "User",
        role: data.role || "user",
        country: "US",
      },
    });
  },

  async createPost(
    userId: string,
    data: { title?: string; content?: string } = {}
  ) {
    return prisma.post.create({
      data: {
        title: data.title || "Test Post",
        content: data.content || "Test content",
        userId,
      },
    });
  },

  async createComment(userId: string, postId: string, content?: string) {
    return prisma.comment.create({
      data: {
        content: content || "Test comment",
        userId,
        postId,
      },
    });
  },

  generateToken(user: { id: string; email: string; role: string }) {
    return jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      jwtConfig.secret,
      { expiresIn: "1h" }
    );
  },
};

// Test database setup and teardown
export const dbSetup = {
  async cleanup() {
    const tables = ["Comment", "Post", "User"];

    for (const table of tables) {
      await prisma.$executeRawUnsafe(`TRUNCATE TABLE "${table}" CASCADE;`);
    }
  },
};

// Test request builders
export const requestBuilder = {
  withAuth(token: string) {
    return {
      get: (url: string) =>
        testApi.get(url).set("Authorization", `Bearer ${token}`),
      post: (url: string, body?: any) =>
        testApi.post(url).set("Authorization", `Bearer ${token}`).send(body),
      put: (url: string, body?: any) =>
        testApi.put(url).set("Authorization", `Bearer ${token}`).send(body),
      patch: (url: string, body?: any) =>
        testApi.patch(url).set("Authorization", `Bearer ${token}`).send(body),
      delete: (url: string) =>
        testApi.delete(url).set("Authorization", `Bearer ${token}`),
    };
  },
};

// Common test assertions
export const assertions = {
  isValidationError(response: supertest.Response) {
    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty("error");
  },

  isUnauthorized(response: supertest.Response) {
    expect(response.status).toBe(401);
    expect(response.body).toHaveProperty("error");
  },

  isForbidden(response: supertest.Response) {
    expect(response.status).toBe(403);
    expect(response.body).toHaveProperty("error");
  },

  isNotFound(response: supertest.Response) {
    expect(response.status).toBe(404);
    expect(response.body).toHaveProperty("error");
  },
};

// Example usage in a test file:
/*
import { describe, it, beforeEach, expect } from 'vitest';
import { 
  testApi, 
  testHelpers, 
  dbSetup, 
  requestBuilder, 
  assertions 
} from './setup';

describe('Post API', () => {
  beforeEach(async () => {
    await dbSetup.cleanup();
  });

  it('should create a post', async () => {
    // Create test user
    const user = await testHelpers.createUser();
    const token = testHelpers.generateToken(user);

    // Make authenticated request
    const response = await requestBuilder
      .withAuth(token)
      .post('/api/posts')
      .send({
        title: 'Test Post',
        content: 'Test content'
      });

    expect(response.status).toBe(201);
    expect(response.body).toHaveProperty('id');
  });
});
*/
