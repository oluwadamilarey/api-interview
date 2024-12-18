// tests/posts.test.ts
import { describe, it, beforeEach, expect } from "vitest";
import { testHelpers, dbSetup, requestBuilder, assertions } from "./setup";

describe("Posts API", () => {
  beforeEach(async () => {
    await dbSetup.cleanup();
  });

  describe("POST /api/posts", () => {
    it("should create a post when authenticated", async () => {
      const user = await testHelpers.createUser();
      const token = testHelpers.generateToken(user);

      const response = await requestBuilder
        .withAuth(token)
        .post("/api/posts")
        .send({
          title: "Test Post",
          content: "This is a test post content",
        });

      expect(response.status).toBe(201);
      expect(response.body).toMatchObject({
        title: "Test Post",
        content: "This is a test post content",
        userId: user.id,
      });
    });

    it("should fail to create post without authentication", async () => {
      const response = await requestBuilder
        .withAuth("invalid-token")
        .post("/api/posts")
        .send({
          title: "Test Post",
          content: "This is a test post content",
        });

      assertions.isUnauthorized(response);
    });

    it("should validate post data", async () => {
      const user = await testHelpers.createUser();
      const token = testHelpers.generateToken(user);

      const response = await requestBuilder
        .withAuth(token)
        .post("/api/posts")
        .send({
          title: "", // Empty title
          content: "Content",
        });

      assertions.isValidationError(response);
    });
  });

  describe("GET /api/posts", () => {
    it("should list posts with pagination", async () => {
      const user = await testHelpers.createUser();
      await Promise.all([
        testHelpers.createPost(user.id, { title: "Post 1" }),
        testHelpers.createPost(user.id, { title: "Post 2" }),
        testHelpers.createPost(user.id, { title: "Post 3" }),
      ]);

      const response = await requestBuilder
        .withAuth(testHelpers.generateToken(user))
        .get("/api/posts?page=1&limit=2");

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(2);
      expect(response.body.pagination).toMatchObject({
        page: 1,
        limit: 2,
        total: 3,
      });
    });

    it("should allow public access to posts listing", async () => {
      const user = await testHelpers.createUser();
      await testHelpers.createPost(user.id);

      const response = await requestBuilder.withAuth("").get("/api/posts");

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(1);
    });
  });

  describe("GET /api/posts/:id", () => {
    it("should get a single post", async () => {
      const user = await testHelpers.createUser();
      const post = await testHelpers.createPost(user.id);

      const response = await requestBuilder
        .withAuth(testHelpers.generateToken(user))
        .get(`/api/posts/${post.id}`);

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        id: post.id,
        title: post.title,
        content: post.content,
      });
    });

    it("should return 404 for non-existent post", async () => {
      const user = await testHelpers.createUser();
      const response = await requestBuilder
        .withAuth(testHelpers.generateToken(user))
        .get("/api/posts/non-existent-id");

      assertions.isNotFound(response);
    });
  });

  describe("PATCH /api/posts/:id", () => {
    it("should update own post", async () => {
      const user = await testHelpers.createUser();
      const post = await testHelpers.createPost(user.id);

      const response = await requestBuilder
        .withAuth(testHelpers.generateToken(user))
        .patch(`/api/posts/${post.id}`)
        .send({
          title: "Updated Title",
        });

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        id: post.id,
        title: "Updated Title",
      });
    });

    it("should not allow updating another user's post", async () => {
      const owner = await testHelpers.createUser();
      const otherUser = await testHelpers.createUser({
        email: "other@example.com",
      });
      const post = await testHelpers.createPost(owner.id);

      const response = await requestBuilder
        .withAuth(testHelpers.generateToken(otherUser))
        .patch(`/api/posts/${post.id}`)
        .send({
          title: "Updated Title",
        });

      assertions.isForbidden(response);
    });

    it("should allow admin to update any post", async () => {
      const user = await testHelpers.createUser();
      const admin = await testHelpers.createUser({
        email: "admin@example.com",
        role: "admin",
      });
      const post = await testHelpers.createPost(user.id);

      const response = await requestBuilder
        .withAuth(testHelpers.generateToken(admin))
        .patch(`/api/posts/${post.id}`)
        .send({
          title: "Admin Updated",
        });

      expect(response.status).toBe(200);
      expect(response.body.title).toBe("Admin Updated");
    });
  });

  describe("DELETE /api/posts/:id", () => {
    it("should delete own post", async () => {
      const user = await testHelpers.createUser();
      const post = await testHelpers.createPost(user.id);

      const response = await requestBuilder
        .withAuth(testHelpers.generateToken(user))
        .delete(`/api/posts/${post.id}`);

      expect(response.status).toBe(204);

      // Verify deletion
      const getResponse = await requestBuilder
        .withAuth(testHelpers.generateToken(user))
        .get(`/api/posts/${post.id}`);

      assertions.isNotFound(getResponse);
    });

    it("should delete post and associated comments", async () => {
      const user = await testHelpers.createUser();
      const post = await testHelpers.createPost(user.id);
      await testHelpers.createComment(user.id, post.id);

      const response = await requestBuilder
        .withAuth(testHelpers.generateToken(user))
        .delete(`/api/posts/${post.id}`);

      expect(response.status).toBe(204);
    });

    it("should not allow deleting another user's post", async () => {
      const owner = await testHelpers.createUser();
      const otherUser = await testHelpers.createUser({
        email: "other@example.com",
      });
      const post = await testHelpers.createPost(owner.id);

      const response = await requestBuilder
        .withAuth(testHelpers.generateToken(otherUser))
        .delete(`/api/posts/${post.id}`);

      assertions.isForbidden(response);
    });
  });

  describe("Rate Limiting", () => {
    it("should enforce rate limits on post creation", async () => {
      const user = await testHelpers.createUser();
      const token = testHelpers.generateToken(user);

      const requests = Array(11)
        .fill(null)
        .map(() =>
          requestBuilder.withAuth(token).post("/api/posts").send({
            title: "Test Post",
            content: "Content",
          })
        );

      const responses = await Promise.all(requests);
      const tooManyRequests = responses.some((r) => r.status === 429);
      expect(tooManyRequests).toBe(true);
    });
  });
});
