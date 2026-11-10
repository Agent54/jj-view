/**
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import * as path from 'node:path';
import { ARTIFACT_DIR, expect, test, waitForScmReady } from './standalone-fixture';

test('context menus support press, move, and release with ordinary click and keyboard fallback', async ({
    page,
    server,
    testRepo,
}) => {
    testRepo.writeFile('release.txt', 'release\n');
    testRepo.describe('Release candidate');
    testRepo.new();
    await page.goto(server.serverUrl);
    await waitForScmReady(page);
    const row = page.locator('.commit-row').filter({ hasText: 'Release candidate' });
    const description = row.locator('.commit-desc');
    await description.hover();
    await page.mouse.down({ button: 'right' });
    const menu = page.getByTestId('context-menu');
    const createTag = page.getByTestId('menu-item-jj-view.createTag');
    await expect(createTag).toBeVisible();
    const itemBox = await createTag.boundingBox();
    if (!itemBox) {
        throw new Error('Expected a visible menu item');
    }
    await page.mouse.move(itemBox.x + itemBox.width / 2, itemBox.y + itemBox.height / 2, { steps: 5 });
    await page.mouse.up({ button: 'right' });
    await expect(menu).toHaveCount(0);
    const input = page.getByTestId('quick-input-text-input');
    await expect(input).toBeVisible();
    await input.fill('v1.0.0');
    await input.press('Enter');
    await expect(row.locator('.tag-wrapper', { hasText: 'v1.0.0' })).toBeVisible();
    await expect(page.getByTestId('quick-input-widget')).toHaveCount(0);
    await expect(menu).toHaveCount(0);

    // Releasing at the original position must keep the menu open without selecting an item.
    await description.click({ button: 'right' });
    await expect(createTag).toBeVisible();
    await createTag.click();
    await expect(input).toBeVisible();
    await page.keyboard.press('Escape');

    // Releasing outside cancels the gesture.
    await description.hover();
    await page.mouse.down({ button: 'right' });
    await expect(menu).toBeVisible();
    await page.mouse.move(900, 100, { steps: 5 });
    await page.mouse.up({ button: 'right' });
    await expect(menu).toHaveCount(0);
    await expect(page.getByTestId('quick-input-widget')).toHaveCount(0);

    await row.focus();
    await page.keyboard.press('Shift+F10');
    await expect(menu).toBeVisible();
    await page.keyboard.press('ArrowDown');
    await expect(menu.getByRole('menuitem').first()).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(menu).toHaveCount(0);
});

test('Source Control collapses, preserves drafts and split size, and persists across reloads', async ({
    page,
    server,
    testRepo,
}) => {
    testRepo.writeFile('base.txt', 'base\n');
    testRepo.describe('Base commit');
    testRepo.new();
    await page.goto(server.serverUrl);
    await waitForScmReady(page);
    const scm = page.getByTestId('scm-pane');
    const log = page.getByTestId('log-pane');
    const toggle = page.getByTestId('scm-collapse-toggle');
    const input = scm.getByRole('textbox', { name: 'Commit description' });
    await expect(log.getByText('Base commit')).toBeVisible();
    await input.fill('Unsaved draft');
    const originalLogHeight = await log.evaluate((el) => el.getBoundingClientRect().height);

    await toggle.click();
    await expect(scm).toHaveAttribute('data-collapsed', 'true');
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await expect(input).toBeHidden();
    await expect(scm).toHaveCSS('height', '35px');
    expect(await log.evaluate((el) => el.getBoundingClientRect().height)).toBeGreaterThan(originalLogHeight);

    await scm.getByTestId('scm-settings-button').click();
    await expect(page.getByTestId('settings-modal')).toBeVisible();
    await expect(scm).toHaveAttribute('data-collapsed', 'true');
    await page.keyboard.press('Escape');
    await toggle.focus();
    await toggle.press('Enter');
    await expect(input).toHaveValue('Unsaved draft');
    await expect
        .poll(async () => Math.abs((await log.evaluate((el) => el.getBoundingClientRect().height)) - originalLogHeight))
        .toBeLessThanOrEqual(2);

    await toggle.click();
    await page.reload();
    await expect(scm).toHaveAttribute('data-collapsed', 'true');
    await expect(scm).toHaveCSS('height', '35px');
    await expect(log.getByText('Base commit')).toBeVisible();
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'source-control-collapsed.png') });

    await page.getByTestId('log-collapse-toggle').click();
    await expect(log).toHaveCSS('height', '35px');
    await expect(scm).toHaveCSS('height', '35px');
    await page.getByTestId('log-collapse-toggle').click();
    await expect(log.getByText('Base commit')).toBeVisible();

    await page.setViewportSize({ width: 450, height: 720 });
    await expect(page.getByTestId('narrow-layout')).toBeVisible();
    await expect(scm).toHaveAttribute('data-collapsed', 'false');
    await expect(toggle).toHaveCount(0);
    await expect(scm.getByRole('textbox', { name: 'Commit description' })).toBeVisible();
});

test('action tooltips wait 800 ms and cancel when the pointer leaves', async ({ page, server, testRepo }) => {
    testRepo.writeFile('base.txt', 'base\n');
    testRepo.describe('Base commit');
    testRepo.new();
    await page.goto(server.serverUrl);
    await waitForScmReady(page);
    const row = page.locator('.commit-row').filter({ hasText: 'Base commit' });
    await row.hover();
    const button = row.getByRole('button', { name: 'New Child', exact: true });
    await expect(button).toBeVisible();
    await page.clock.install();
    await page.clock.pauseAt(new Date());
    await button.hover();
    await page.clock.runFor(799);
    await expect(page.getByRole('tooltip')).toHaveCount(0);
    await page.clock.runFor(1);
    await expect(page.getByRole('tooltip')).toBeVisible();
    await row.locator('.commit-desc').hover();
    await expect(page.getByRole('tooltip')).toHaveCount(0);
    await button.hover();
    await page.clock.runFor(250);
    await row.locator('.commit-desc').hover();
    await page.clock.runFor(800);
    await expect(page.getByRole('tooltip')).toHaveCount(0);
    await page.clock.resume();
});
