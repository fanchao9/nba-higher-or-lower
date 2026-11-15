import { expect, test as base, type Page } from "@playwright/test";

// Fails any test during which the page throws an uncaught error or logs a
// console error. Failed resource loads are ignored: player headshots come from
// the NBA CDN and the game falls back to initials when they don't load.
export const test = base.extend<{ page: Page }>({
  // (`provide`, not `use`: the react-hooks lint rule mistakes `use` for a hook)
  page: async ({ page }, provide) => {
    const problems: string[] = [];
    page.on("pageerror", (e) => problems.push(`pageerror: ${e.message}`));
    page.on("console", (m) => {
      if (m.type() === "error" && !/Failed to load resource/i.test(m.text())) {
        problems.push(`console: ${m.text()}`);
      }
    });
    await provide(page);
    expect(problems, "unexpected errors in the browser").toEqual([]);
  },
});

export { expect };

export const leftCard = (page: Page) => page.locator("article[data-slot=left]");
export const rightCard = (page: Page) => page.locator("article[data-slot=right]");
export const showAllSwitch = (page: Page) =>
  page.getByRole("switch", { name: "Show all stats" });
export const settingsButton = (page: Page) =>
  page.getByRole("button", { name: "Settings" }).first();
export const settingsDialog = (page: Page) =>
  page.getByRole("dialog", { name: "Game settings" });

/** Opens the settings menu, runs `change`, then presses GO. */
export async function applySettings(
  page: Page,
  change: (dialog: ReturnType<typeof settingsDialog>) => Promise<void>,
) {
  await settingsButton(page).click();
  const dialog = settingsDialog(page);
  await expect(dialog).toBeVisible();
  await change(dialog);
  await dialog.getByRole("button", { name: "GO" }).click();
  await expect(dialog).toBeHidden();
}

/** The stat abbreviation in the current question, e.g. "PPG". */
export async function currentStat(page: Page): Promise<string> {
  const text = (await page.getByTestId("question").textContent()) ?? "";
  const match = text.match(/higher or lower (\w+) than/);
  if (!match) throw new Error(`no stat in question: "${text}"`);
  return match[1];
}

/**
 * Makes a guess and waits for the game to react. Resolves to "next" when a new
 * round started (the question changed) or "over" when the guess was wrong.
 */
export async function guessOnce(
  page: Page,
  guess: "Higher" | "Lower",
): Promise<"next" | "over"> {
  const before = await page.getByTestId("question").textContent();
  await page.getByRole("button", { name: guess, exact: true }).click();
  const gameOver = page.getByText("Game over");
  let outcome: "next" | "over" | "pending" = "pending";
  await expect
    .poll(
      async () => {
        if (await gameOver.isVisible()) outcome = "over";
        else if ((await page.getByTestId("question").textContent()) !== before) {
          outcome = "next";
        }
        return outcome;
      },
      { timeout: 20_000, intervals: [50] },
    )
    .not.toBe("pending");
  return outcome as "next" | "over";
}
