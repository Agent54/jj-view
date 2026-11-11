/**
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import * as path from 'node:path';
import { ARTIFACT_DIR, expect, recordGifFlow, test, waitForScmReady } from './standalone-fixture';

test('hover controls have a clear boundary, explanatory tooltips, and no abandon button', async ({
    page,
    server,
    testRepo,
}) => {
    testRepo.writeFile('base.txt', 'base\n');
    testRepo.describe('Base commit');
    testRepo.new();
    testRepo.writeFile('feature.txt', 'feature\n');
    testRepo.describe('Feature commit');
    testRepo.new();

    await page.goto(server.serverUrl);
    await waitForScmReady(page);
    const row = page.locator('.commit-row').filter({ hasText: 'Feature commit' });
    const actions = row.locator('.hover-actions');
    await row.hover();
    await expect(actions).toBeVisible();
    await expect(actions).toHaveCSS('border-top-style', 'solid');
    await expect(actions).toHaveCSS('border-top-width', '1px');
    await expect(actions).toHaveCSS('mask-image', 'none');
    await expect(actions.getByRole('button')).toHaveCount(4);
    await expect(actions.getByRole('button', { name: 'Abandon' })).toHaveCount(0);
    await expect(row).toHaveCSS('cursor', 'pointer');
    await expect(page.locator('.commit-graph')).toHaveCSS('user-select', 'none');

    for (const alignment of ['aligned', 'compact']) {
        await page.evaluate(async (value) => {
            await window.__JJ_VIEW_ENV__?.config.update?.('graphLabelAlignment', value);
        }, alignment);
        await row.hover();
        await expect(async () => {
            const actionsBox = await actions.boundingBox();
            const descriptionBox = await row.locator('.commit-desc').boundingBox();
            const idBox = await row.locator('.commit-id').boundingBox();
            if (!actionsBox || !descriptionBox || !idBox) {
                throw new Error('Expected visible commit actions, description, and change ID');
            }
            expect(Math.abs(actionsBox.x - descriptionBox.x)).toBeLessThan(1);
            expect(actionsBox.x).toBeGreaterThan(idBox.x + idBox.width);
        }).toPass();
    }

    for (const [name, description] of [
        ['Generate description with AI', 'Generate a description for this commit without switching the working copy.'],
        ['New Child', 'Create a new working-copy revision after this commit.'],
        ['Edit Commit', 'Make this commit the working copy so you can edit its files.'],
        ['Squash', "Move this commit's changes into its parent and remove this commit."],
    ]) {
        const button = actions.getByRole('button', { name, exact: true });
        await button.hover();
        await expect(button).toHaveCSS('cursor', 'pointer');
        await expect(page.getByRole('tooltip')).toHaveText(description);
        await page.keyboard.press('Escape');
        await expect(page.getByRole('tooltip')).toHaveCount(0);
    }

    await recordGifFlow(
        page,
        async (capture) => {
            for (const theme of ['pierre-dark-soft', 'pierre-light']) {
                await page.evaluate(async (value) => {
                    await window.__JJ_VIEW_ENV__?.config.update?.('appearance.theme', value);
                }, theme);
                await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
                const headerBackground = await page
                    .getByTestId('log-header')
                    .evaluate((el) => getComputedStyle(el).backgroundColor);
                const headerBorder = await page
                    .getByTestId('log-header')
                    .evaluate((el) => getComputedStyle(el).borderBottomColor);
                await row.locator('.commit-desc').hover();
                await expect(actions).toHaveCSS('background-color', headerBackground);
                await expect(actions).toHaveCSS('border-top-color', headerBorder);
                await actions.getByRole('button', { name: 'Edit Commit', exact: true }).hover();
                await expect(page.getByRole('tooltip')).toBeVisible();
                await page.screenshot({ path: path.join(ARTIFACT_DIR, `commit-actions-${theme}.png`) });
                await capture();
            }
        },
        { outputPath: path.join(ARTIFACT_DIR, 'commit-actions.gif') },
    );

    await actions.getByRole('button', { name: 'New Child', exact: true }).focus();
    await expect(page.getByRole('tooltip')).toHaveText('Create a new working-copy revision after this commit.');
    await row.locator('.commit-desc').click({ button: 'right' });
    await expect(page.getByTestId('menu-item-jj-view.abandon')).toBeVisible();
    await page.keyboard.press('Escape');
    await actions.click({ button: 'right' });
    await expect(page.getByTestId('context-menu')).toBeVisible();
    await expect(page.getByTestId('menu-item-jj-view.toggleCommitAction.abandon.on')).toHaveCount(0);
    await expect(page.getByTestId('menu-item-jj-view.toggleCommitAction.abandon.off')).toHaveCount(0);
});

for (const alignment of ['aligned', 'compact']) {
    test(`graph dots support selection, context menus, and dragging with ${alignment} labels`, async ({
        page,
        server,
        testRepo,
    }) => {
        testRepo.writeFile('base.txt', 'base\n');
        testRepo.describe('Base commit');
        const baseId = testRepo.getCommitId('@');
        testRepo.new();
        testRepo.writeFile('feature.txt', 'feature\n');
        testRepo.describe('Feature commit');
        const featureId = testRepo.getCommitId('@');
        testRepo.new();

        await page.goto(server.serverUrl);
        await waitForScmReady(page);
        await page.evaluate(async (value) => {
            await window.__JJ_VIEW_ENV__?.config.update?.('graphLabelAlignment', value);
        }, alignment);

        const row = page.locator('.commit-row').filter({ hasText: 'Feature commit' });
        const baseRow = page.locator('.commit-row').filter({ hasText: 'Base commit' });
        const dot = page.locator(`.graph-svg [data-commit-id="${featureId}"]`);
        await expect(dot).toBeVisible();
        const dotBox = await dot.boundingBox();
        if (!dotBox) {
            throw new Error('Expected a visible graph dot');
        }
        const x = dotBox.x + dotBox.width / 2;
        const y = dotBox.y + dotBox.height / 2;
        const hit = await page.evaluate(
            ({ x, y }) => {
                const element = document.elementFromPoint(x, y);
                return {
                    changeId: element?.closest('.commit-row')?.getAttribute('data-change-id'),
                    cursor: element ? getComputedStyle(element).cursor : undefined,
                };
            },
            { x, y },
        );
        expect(hit.changeId).toBe(await row.getAttribute('data-change-id'));
        expect(hit.cursor).toBe('pointer');

        await page.mouse.click(x, y);
        await expect(row).toHaveAttribute('aria-selected', 'true');
        await expect(page.getByTestId('commit-details-view').locator('.commit-textarea')).toHaveValue('Feature commit');

        const baseDotBox = await page.locator(`.graph-svg [data-commit-id="${baseId}"]`).boundingBox();
        if (!baseDotBox) {
            throw new Error('Expected a visible base graph dot');
        }
        await page.keyboard.down('ControlOrMeta');
        await page.mouse.click(baseDotBox.x + baseDotBox.width / 2, baseDotBox.y + baseDotBox.height / 2);
        await page.keyboard.up('ControlOrMeta');
        await expect(row).toHaveAttribute('aria-selected', 'true');
        await expect(baseRow).toHaveAttribute('aria-selected', 'true');

        await page.mouse.click(x, y);
        await expect(baseRow).toHaveAttribute('aria-selected', 'false');
        await page.mouse.click(x, y, { button: 'right' });
        await expect(page.getByTestId('menu-item-jj-view.createTag')).toBeVisible();
        await expect(page.getByTestId('menu-item-jj-view.abandon')).toBeVisible();
        await page.keyboard.press('Escape');

        await page.mouse.move(x, y);
        await page.mouse.down();
        await page.mouse.move(x + 40, y + 6, { steps: 5 });
        await expect(page.locator('.drag-preview-overlay')).toBeVisible();
        await expect(page.locator('.drag-preview-overlay')).toContainText('Feature commit');
        await page.keyboard.press('Escape');
        await page.mouse.up();
        await expect(page.locator('.drag-preview-overlay')).toHaveCount(0);
        expect(await page.evaluate(() => window.getSelection()?.toString() ?? '')).toBe('');
        expect(testRepo.getCommitId('@-')).toBe(featureId);
    });
}
