import { expect, test, _electron as electron } from "@playwright/test";
import path from "node:path";
import { fileURLToPath } from "node:url";

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const desktopRoot = path.resolve(testDirectory, "../..");
const screenshotPath = path.resolve(
  desktopRoot,
  "test-results",
  "desktop-smoke.png"
);

test("renders the Electron workspace", async () => {
  const app = await electron.launch({
    args: [desktopRoot],
    cwd: desktopRoot
  });

  try {
    const window = await app.firstWindow();

    await expect(window.getByText("Gravity", { exact: true })).toBeVisible();
    await expect(
      window.getByRole("button", { exact: true, name: "Notes" })
    ).toBeVisible();
    await expect(window.locator(".notebook-label")).toHaveText("Cuaderno");

    await window.screenshot({ fullPage: true, path: screenshotPath });
  } finally {
    await app.close();
  }
});
