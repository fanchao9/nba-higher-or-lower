import {
  applySettings,
  currentStat,
  expect,
  guessOnce,
  leftCard,
  rightCard,
  settingsButton,
  settingsDialog,
  showAllSwitch,
  test,
} from "./fixtures";

test.describe("the game", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await expect(rightCard(page)).toBeVisible();
  });

  test("starts a playable round", async ({ page }) => {
    await expect(leftCard(page)).toBeVisible();
    await expect(rightCard(page)).toContainText("??");
    await expect(leftCard(page)).not.toContainText("??");
    await expect(page.getByTestId("score")).toContainText("0");
    await expect(page.getByTestId("question")).toContainText(/higher or lower/);
    await expect(page.getByRole("button", { name: "Higher", exact: true })).toBeEnabled();
    await expect(page.getByRole("button", { name: "Lower", exact: true })).toBeEnabled();
  });

  test("a guess reveals the number and either advances or ends the game", async ({ page }) => {
    await page.getByRole("button", { name: "Higher", exact: true }).click();
    await expect(page.getByRole("button", { name: "Higher", exact: true })).toBeDisabled();
    // The hidden value is replaced by a number.
    await expect(rightCard(page)).not.toContainText("??", { timeout: 5_000 });

    // Then: wrong -> game over panel, right -> a fresh round with score 1.
    const gameOver = page.getByTestId("game-over");
    const nextRound = rightCard(page).getByText("??");
    await expect(gameOver.or(nextRound)).toBeVisible({ timeout: 15_000 });
    if (await gameOver.isVisible()) {
      await expect(page.getByRole("button", { name: "Play again" })).toBeVisible();
    } else {
      await expect(page.getByTestId("score")).toContainText("1");
    }
  });

  test("Play again starts a fresh game with score 0", async ({ page }) => {
    // Keep guessing until we lose; the loss is guaranteed eventually.
    for (let i = 0; i < 40; i++) {
      if ((await guessOnce(page, i % 2 ? "Higher" : "Lower")) === "over") break;
    }
    await expect(page.getByTestId("game-over")).toBeVisible();
    await page.getByRole("button", { name: "Play again" }).click();
    await expect(page.getByTestId("game-over")).toBeHidden();
    await expect(page.getByTestId("score")).toContainText("0");
    await expect(rightCard(page)).toContainText("??");
  });
});

test.describe("settings menu", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await expect(rightCard(page)).toBeVisible();
  });

  test("opens, and closes with Escape and the close button", async ({ page }) => {
    await settingsButton(page).click();
    await expect(settingsDialog(page)).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(settingsDialog(page)).toBeHidden();

    await settingsButton(page).click();
    await settingsDialog(page).getByRole("button", { name: "Close settings" }).click();
    await expect(settingsDialog(page)).toBeHidden();
  });

  test("at least one stat always stays selected", async ({ page }) => {
    await settingsButton(page).click();
    const dialog = settingsDialog(page);
    const ppg = dialog.getByRole("checkbox", { name: "PPG" });
    const rpg = dialog.getByRole("checkbox", { name: "RPG" });

    await expect(ppg).toBeChecked();
    await expect(ppg).toBeDisabled(); // the only one selected

    await rpg.check();
    await expect(ppg).toBeEnabled();
    await ppg.uncheck();
    await expect(rpg).toBeChecked();
    await expect(rpg).toBeDisabled();
  });

  test("shows how many entries match and disables GO when none do", async ({ page }) => {
    await settingsButton(page).click();
    const dialog = settingsDialog(page);
    await expect(dialog.getByText(/\d+ players match these settings/)).toBeVisible();

    // Nobody with 10+ award seasons played in the earliest NBA season.
    await dialog.getByRole("slider", { name: "From year" }).press("Home");
    await dialog.getByRole("slider", { name: "To year" }).press("Home");
    await dialog.getByRole("slider", { name: "Minimum award seasons" }).press("End");
    await expect(dialog.getByText(/No players match/)).toBeVisible();
    await expect(dialog.getByRole("button", { name: "GO" })).toBeDisabled();
  });

  test("GO applies the settings and starts a new game", async ({ page }) => {
    await applySettings(page, async (dialog) => {
      await dialog.getByRole("switch", { name: "Compare seasons" }).click();
    });
    await expect(page.getByText("Award-winning seasons", { exact: true })).toBeVisible();
    // Season cards show "2015-16 · TEAM".
    await expect(rightCard(page)).toContainText(/\d{4}-\d{2}/);
    await expect(page.getByTestId("score")).toContainText("0");
  });

  test("only compares the stats that were checked", async ({ page }) => {
    await applySettings(page, async (dialog) => {
      await dialog.getByRole("checkbox", { name: "RPG" }).check();
      await dialog.getByRole("checkbox", { name: "PPG" }).uncheck();
    });
    await expect(page.getByTestId("question")).toContainText("RPG");
    expect(await currentStat(page)).toBe("RPG");
  });

  test("keeps GO visible without scrolling on a phone", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 700 });
    await settingsButton(page).click();
    await expect(settingsDialog(page).getByRole("button", { name: "GO" })).toBeInViewport();
  });
});

test.describe("show all stats", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await expect(rightCard(page)).toBeVisible();
  });

  test("lists all eight stats and hides only the compared one", async ({ page }) => {
    await showAllSwitch(page).click();
    for (const card of [leftCard(page), rightCard(page)]) {
      await expect(card.locator("dl > div")).toHaveCount(8);
      await expect(card.locator("dt")).toHaveText([
        "PPG", "RPG", "APG", "SPG", "BPG", "FG%", "3PT%", "FT%",
      ]);
    }
    await expect(rightCard(page).locator("dd", { hasText: "??" })).toHaveCount(1);
    await expect(leftCard(page).locator("dd", { hasText: "??" })).toHaveCount(0);
    // The hidden row is the one being compared.
    const stat = await currentStat(page);
    await expect(
      rightCard(page).locator("dl > div", { hasText: "??" }).locator("dt"),
    ).toHaveText(stat);
  });

  test("turning it off returns to the single big stat", async ({ page }) => {
    await showAllSwitch(page).click();
    await expect(rightCard(page).locator("dl")).toBeVisible();
    await showAllSwitch(page).click();
    await expect(rightCard(page).locator("dl")).toHaveCount(0);
    await expect(rightCard(page)).toContainText(/Career [A-Z]+/);
  });

  test("the choice survives pressing GO", async ({ page }) => {
    await showAllSwitch(page).click();
    await applySettings(page, async (dialog) => {
      await dialog.getByRole("switch", { name: "Compare seasons" }).click();
    });
    await expect(showAllSwitch(page)).toBeChecked();
    await expect(rightCard(page).locator("dl > div")).toHaveCount(8);
  });

  test("shows real shooting percentages in season mode", async ({ page }) => {
    await showAllSwitch(page).click();
    await applySettings(page, async (dialog) => {
      await dialog.getByRole("switch", { name: "Compare seasons" }).click();
    });
    await expect(leftCard(page).locator("dl > div", { hasText: "FG%" })).toContainText(/\d+\.\d%/);
  });

  // Regression: switching views used to remount the card and replay the
  // "stat slides to the next stat" animation.
  test("toggling the view does not replay the stat slide", async ({ page }) => {
    test.setTimeout(180_000);
    await applySettings(page, async (dialog) => {
      for (const name of ["RPG", "APG", "SPG", "BPG"]) {
        await dialog.getByRole("checkbox", { name }).check();
      }
    });

    // Play until a new round compares a different stat than the one before.
    let changed = false;
    for (let i = 0; i < 60 && !changed; i++) {
      const before = await currentStat(page);
      const outcome = await guessOnce(page, i % 2 ? "Higher" : "Lower");
      if (outcome === "over") {
        await page.getByRole("button", { name: "Play again" }).click();
        await expect(page.getByTestId("game-over")).toBeHidden();
        continue;
      }
      changed = (await currentStat(page)) !== before;
    }
    expect(changed, "never reached a round with a different stat").toBe(true);

    const slideOut = leftCard(page).getByTestId("stat-slide-out");
    await expect(slideOut).toHaveCount(0, { timeout: 5_000 }); // let the slide finish

    for (let i = 0; i < 2; i++) {
      await showAllSwitch(page).click();
      await page.waitForTimeout(150);
      await expect(slideOut).toHaveCount(0);
      await showAllSwitch(page).click();
      await page.waitForTimeout(150);
      await expect(slideOut).toHaveCount(0);
    }
  });
});
