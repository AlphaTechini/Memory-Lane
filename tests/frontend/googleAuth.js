import { render, fireEvent } from "@testing-library/svelte";
import "@testing-library/jest-dom";
import GoogleSignInButton from "../src/lib/components/GoogleSignInButton.svelte";
import * as auth from "../src/lib/auth.js";

// Mock the backend call
jest.spyOn(global, "fetch").mockImplementation((url, options) => {
  if (url.includes("/auth/google")) {
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve({
        user: { email: "test@example.com" },
        token: "jwt123",
      }),
    });
  }
  return Promise.reject(new Error("Unknown endpoint"));
});

// Also spy on your helper function
jest.spyOn(auth, "loginWithGoogle");

test("Google button calls backend and receives token", async () => {
  const { getByText } = render(GoogleSignInButton);

  const btn = getByText("Sign in with Google"); // adjust if your text differs
  await fireEvent.click(btn);

  expect(auth.loginWithGoogle).toHaveBeenCalled();
  expect(global.fetch).toHaveBeenCalledWith(
    expect.stringContaining("/auth/google"),
    expect.objectContaining({ method: "POST" })
  );
});
