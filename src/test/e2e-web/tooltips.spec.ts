/**
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import * as path from 'node:path';
import { ARTIFACT_DIR, expect, test, waitForScmReady } from './standalone-fixture';

test('tooltips stay immediate between buttons and reset after an idle interval', async ({ page, server, testRepo }) => {
    testRepo.writeFile('feature.txt', 'feature\n');
    testRepo.describe('Feature commit');
    testRepo.new();
    await page.goto(server.serverUrl);
    await waitForScmReady(page);

    const row = page.locator('.commit-row', { hasText: 'Feature commit' });
    const first = row.getByRole('button', { name: 'New Child', exact: true });
    const second = row.getByRole('button', { name: 'Edit Commit', exact: true });
    const tooltip = page.getByRole('tooltip');
    await row.hover();
    await first.hover();
    await page.waitForTimeout(350);
    await expect(tooltip).toHaveCount(0);
    await expect(tooltip).toHaveText('Create a new working-copy revision after this commit.');

    await second.hover();
    await expect(tooltip).toHaveText('Make this commit the working copy so you can edit its files.', { timeout: 300 });
    await page.mouse.move(900, 100);
    await expect(tooltip).toHaveCount(0);
    await page.waitForTimeout(1100);
    await row.hover();
    await first.hover();
    await page.waitForTimeout(350);
    await expect(tooltip).toHaveCount(0);
    await expect(tooltip).toHaveText('Create a new working-copy revision after this commit.');
    await page.keyboard.press('Escape');
    await expect(tooltip).toHaveCount(0);
});

test('graph dot tooltips use readable theme colors and label empty and immutable commits', async ({ page, server, testRepo }) => {
    testRepo.writeFile('feature.txt', 'feature\n');
    testRepo.describe('Feature commit');
    const featureCommit = testRepo.getCommitId('@');
    testRepo.new();
    const emptyCommit = testRepo.getCommitId('@');
    const rootCommit = testRepo.getCommitId('root()');
    await page.goto(server.serverUrl);
    await waitForScmReady(page);

    const tooltip = page.getByRole('tooltip');
    async function hoverDot(commitId: string): Promise<void> {
        const box = await page.locator(`.graph-svg [data-commit-id="${commitId}"]`).boundingBox();
        if (!box) {
            throw new Error('Expected a visible graph dot');
        }
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    }

    let darkBackground = '';
    for (const theme of ['pierre-dark-cobalt', 'pierre-light']) {
        await page.mouse.move(900, 100);
        await page.evaluate(async value => {
            await window.__JJ_VIEW_ENV__?.config.update?.('appearance.theme', value);
        }, theme);
        await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
        await hoverDot(emptyCommit);
        await expect(tooltip).toContainText('Empty commit');
        await expect(tooltip.locator('.tooltip-heading')).toHaveText('You are here');
        await expect(tooltip).toHaveText(/^You are here\s+.*Empty commit/s);
        await expect(tooltip).toHaveClass(/accented/);
        await expect(tooltip).not.toContainText('Immutable');
        await expect(tooltip).not.toContainText('(no description)');
        await expect(tooltip).toHaveCSS('font-size', '14px');
        const background = await tooltip.evaluate(el => getComputedStyle(el).backgroundColor);
        if (theme === 'pierre-dark-cobalt') {
            await expect(tooltip).toHaveCSS('border-top-color', 'rgb(7, 196, 128)');
            darkBackground = background;
        } else {
            expect(background).not.toBe(darkBackground);
        }
        await page.screenshot({ path: path.join(ARTIFACT_DIR, `graph-tooltip-${theme}.png`) });
        await hoverDot(rootCommit);
        await expect(tooltip).toContainText('Empty commit · Immutable');
        await expect(tooltip.locator('.tooltip-heading')).toHaveCount(0);
        await expect(tooltip).not.toHaveClass(/accented/);
        await hoverDot(featureCommit);
        await expect(tooltip).toContainText('Feature commit');
        await expect(tooltip.locator('.tooltip-heading')).toHaveCount(0);
        await expect(tooltip).not.toHaveClass(/accented/);
        await expect(tooltip).not.toContainText('Empty commit');
        await expect(tooltip).not.toContainText('Immutable');
    }
});
