import { expect, test } from "@playwright/test";

test.describe("public surface", () => {
  test("login page renders the brand and the form", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("img", { name: "Vakyam" })).toBeVisible();
    await expect(page.getByLabel("Email")).toBeVisible();
    await expect(page.getByLabel("Password")).toBeVisible();
    await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Forgot your password?" })).toHaveAttribute("href", "/reset");
  });

  test("wrong credentials are rejected by Supabase", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill("nobody@example.com");
    await page.getByLabel("Password").fill("wrong-password-e2e");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByText("Login failed", { exact: true })).toBeVisible();
    await expect(page.getByText("Invalid login credentials", { exact: true })).toBeVisible();
    await expect(page).toHaveURL(/\/login$/);
  });

  test("reset page offers the email step, then the password step from a recovery link", async ({ page }) => {
    await page.goto("/reset");
    await expect(page.getByRole("button", { name: "Send reset link" })).toBeVisible();
    // A recovery link opens the page fresh, so leave and come back with the hash.
    await page.goto("/login");
    await page.goto("/reset#type=recovery");
    await expect(page.getByRole("button", { name: "Set new password" })).toBeVisible();
  });

  for (const path of ["/", "/voice", "/console", "/console/analytics", "/console/live/4812"]) {
    test(`signed out, ${path} redirects to /login`, async ({ page }) => {
      await page.goto(path);
      await expect(page).toHaveURL(/\/login$/);
      await expect(page.getByLabel("Email")).toBeVisible();
    });
  }

  test("unknown routes show the 404 page", async ({ page }) => {
    await page.goto("/no-such-page");
    await expect(page.getByRole("heading", { name: "404" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Return to Home" })).toBeVisible();
  });

  test("no page-level horizontal scroll on the login page", async ({ page }) => {
    await page.goto("/login");
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
});
