import { expect, test } from "@playwright/test";

test("a signed-out visitor is sent to sign-in", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/sign-in$/);
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  await expect(page.getByLabel("Email")).toBeVisible();
  await expect(page.getByRole("button", { name: "Send me a link" })).toBeVisible();
});

test("sign-in rejects an empty email without calling the server", async ({ page }) => {
  await page.goto("/sign-in");
  await page.getByRole("button", { name: "Send me a link" }).click();
  await expect(page.getByText("Enter your email address.")).toBeVisible();
});

test("every app route is protected", async ({ page }) => {
  for (const path of ["/timeline", "/body", "/share", "/import"]) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/sign-in$/);
  }
});
