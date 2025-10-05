import { OAuth2Client } from "google-auth-library";
import { verifyGoogleToken } from "../../src/services/authService.js";

jest.mock("google-auth-library", () => {
  return {
    OAuth2Client: jest.fn().mockImplementation(() => ({
      verifyIdToken: jest.fn().mockResolvedValue({
        getPayload: () => ({
          sub: "mock-sub",
          email: "mock@example.com",
          name: "Mock User"
        })
      })
    }))
  };
});

describe("verifyGoogleToken", () => {
  it("should return payload if valid", async () => {
    const payload = await verifyGoogleToken("valid.token");
    expect(payload.email).toBe("mock@example.com");
  });

  it("should throw if invalid", async () => {
    OAuth2Client.mockImplementationOnce(() => ({
      verifyIdToken: jest.fn().mockRejectedValue(new Error("Invalid token"))
    }));

    await expect(verifyGoogleToken("bad.token")).rejects.toThrow("Invalid token");
  });
});
