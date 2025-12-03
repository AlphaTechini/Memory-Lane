import Fastify from "fastify";
import supertest from "supertest";
import authRoutes from "../../src/routes/authRoutes.js";
import * as authService from "../../src/services/authService.js";

const fastify = Fastify();
fastify.register(authRoutes);

describe("Google Authentication API", () => {
  let request;

  beforeAll(async () => {
    await fastify.ready();
    request = supertest(fastify.server);
  });

  afterAll(() => fastify.close());

  it("should reject invalid Google tokens", async () => {
    jest.spyOn(authService, "verifyGoogleToken").mockRejectedValue(new Error("Invalid token"));

    const res = await request.post("/auth/google").send({
      credential: "fake.invalid.token"
    });

    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty("error");
  });

  it("should create a new user with Google ID", async () => {
    jest.spyOn(authService, "verifyGoogleToken").mockResolvedValue({
      sub: "google-sub-id-123",
      email: "testuser@example.com",
      name: "Test User"
    });

    // Mock DB response
    jest.spyOn(authService, "findOrCreateGoogleUser").mockResolvedValue({
      id: 1,
      email: "testuser@example.com",
      googleId: "google-sub-id-123",
      password: null
    });

    const res = await request.post("/auth/google").send({
      credential: "valid.google.token"
    });

    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe("testuser@example.com");
    expect(res.body.user.googleId).toBe("google-sub-id-123");
    expect(res.body.user.password).toBeNull();
    expect(res.body).toHaveProperty("token");
  });
});
