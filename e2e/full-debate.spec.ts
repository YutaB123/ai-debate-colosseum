import { test, expect } from "@playwright/test";

test("set up a stub debate, watch it, see a verdict", async ({ page }) => {
  await page.goto("/setup");
  await expect(page.getByText("Configure Debate")).toBeVisible({ timeout: 30_000 });

  await page.getByPlaceholder(/should AI/i).fill("Is fire wet?");

  // Set rounds to 2 for a fast test.
  await page.locator('input[type="number"]').fill("2");

  // Fill the 4 default debater stances.
  const stances = page.getByPlaceholder("Stance (what this AI must defend)");
  await stances.nth(0).fill("Yes, fire is wet");
  await stances.nth(1).fill("No, fire is not wet");
  await stances.nth(2).fill("Conditionally wet");
  await stances.nth(3).fill("Wetness is undefined");

  // The voice picker is browser-dependent; in headless Chromium voiceschanged may not fire reliably.
  // Use page.evaluate to inject a fake voiceURI directly into each select.
  await page.evaluate(() => {
    document.querySelectorAll("select").forEach((sel) => {
      const s = sel as HTMLSelectElement;
      if (s.options.length > 0 && s.value === "" && s.options[0].text.startsWith("—")) {
        const o = document.createElement("option");
        o.value = "stub-voice"; o.text = "Stub Voice"; s.appendChild(o); s.value = "stub-voice";
        s.dispatchEvent(new Event("change", { bubbles: true }));
      }
    });
  });

  await page.getByRole("button", { name: /start debate/i }).click();

  // The stage page loads; the verdict should appear in under 30 seconds with stubs.
  await expect(page.getByText(/Verdict/i)).toBeVisible({ timeout: 30_000 });
});
