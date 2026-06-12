import { expect, test, _electron as electron } from "@playwright/test";
import path from "node:path";
import { fileURLToPath } from "node:url";

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const desktopRoot = path.resolve(testDirectory, "../..");

// Widths called out in the regression report plus a normal desktop viewport.
const VIEWPORTS = [
  { width: 560, height: 760 },
  { width: 760, height: 820 },
  { width: 820, height: 900 },
  { width: 1280, height: 860 }
];

// Containers that previously developed horizontal overflow in Settings.
const OVERFLOW_SELECTORS = [
  ".settings-surface",
  ".settings-canvas",
  ".appearance-theme-card",
  ".theme-picker",
  ".provider-grid"
];

test("Settings has no horizontal overflow across compact widths", async () => {
  const app = await electron.launch({ args: [desktopRoot], cwd: desktopRoot });

  try {
    const window = await app.firstWindow();
    const browserWindow = await app.browserWindow(window);

    // The production window enforces minWidth: 960; relax it for the test so we
    // can drive the renderer down to the verified narrow viewports.
    await browserWindow.evaluate((win) => win.setMinimumSize(320, 320));

    await window.getByRole("button", { name: "Abrir configuración" }).click();

    for (const viewport of VIEWPORTS) {
      await browserWindow.evaluate(
        (win, size) => win.setContentSize(size.width, size.height),
        viewport
      );

      // Exercise both the default provider section and the Appearance card,
      // which live in separate Settings sections.
      for (const section of ["Api provider", "Features"]) {
        await window.getByRole("button", { name: new RegExp(section) }).click();
        await window.waitForTimeout(120);

        const overflows = await window.evaluate((selectors) => {
          return selectors.flatMap((selector) => {
            const element = document.querySelector(selector);
            if (!element) return [];
            return [
              { selector, overflow: element.scrollWidth - element.clientWidth }
            ];
          });
        }, OVERFLOW_SELECTORS);

        for (const entry of overflows) {
          expect(
            entry.overflow,
            `${entry.selector} overflows by ${entry.overflow}px at ${viewport.width}px`
          ).toBeLessThanOrEqual(1);
        }
      }
    }
  } finally {
    await app.close();
  }
});
