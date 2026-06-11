import { expect, test, _electron as electron } from "@playwright/test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
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
  test.setTimeout(120_000);
  const userDataPath = await mkdtemp(path.join(tmpdir(), "gravity-theme-e2e-"));
  let app = await launchApp(userDataPath);

  try {
    let window = await app.firstWindow();

    await expect(window.getByText("Gravity", { exact: true })).toBeVisible();
    await expect(
      window.getByRole("button", { exact: true, name: "Notes" })
    ).toBeVisible();
    await expect(window.getByText("Cuaderno")).toBeVisible();

    await window.getByRole("button", { name: "Abrir configuración" }).click();
    await window.getByRole("button", { name: "02 Features" }).click();
    await expect(
      window.getByRole("heading", { level: 2, name: "Theme" })
    ).toBeVisible();

    await window.getByRole("button", { name: "Claro" }).click();
    await window.getByRole("button", { name: "Libre" }).click();
    await window.getByRole("button", { name: "Añadir color" }).click();

    await expect(window.getByText("4 colores", { exact: true })).toBeVisible();
    await expect
      .poll(() =>
        window.evaluate(
          () => document.documentElement.dataset.colorScheme ?? null
        )
      )
      .toBe("light");

    await app.close();
    app = await launchApp(userDataPath);
    window = await app.firstWindow();

    await window.getByRole("button", { name: "Abrir configuración" }).click();
    await window.getByRole("button", { name: "02 Features" }).click();
    await expect(window.getByRole("button", { name: "Claro" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    await expect(window.getByText("4 colores", { exact: true })).toBeVisible();

    await window.screenshot({ fullPage: true, path: screenshotPath });
  } finally {
    await app.close();
    await rm(userDataPath, { force: true, recursive: true });
  }
});

function launchApp(userDataPath: string) {
  return electron.launch({
    args: [desktopRoot],
    cwd: desktopRoot,
    env: {
      ...process.env,
      GRAVITY_USER_DATA_PATH: userDataPath
    }
  });
}
