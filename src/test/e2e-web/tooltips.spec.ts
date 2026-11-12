/**
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import * as path from 'node:path';
import type { Locator } from '@playwright/test';
import { ARTIFACT_DIR, expect, test, waitForScmReady } from './standalone-fixture';

test('source control and commit details use shared tooltips instead of browser titles', async ({
    page,
    server,
    testRepo,
}) => {
    testRepo.writeFile('docs/changed.ts', 'before\n');
    testRepo.describe('Parent commit');
    testRepo.new();
    testRepo.writeFile('docs/changed.ts', 'after\n');
    testRepo.describe('Working commit');
    const rootChange = testRepo.getChangeId('root()');
    await page.goto(server.serverUrl);
    await waitForScmReady(page);
    await page.evaluate(async () => {
        await window.__JJ_VIEW_ENV__?.config.update?.('appearance.theme', 'pierre-dark-cobalt');
    });

    const tooltip = page.getByRole('tooltip');
    async function checkTooltip(control: Locator, text: string | RegExp): Promise<void> {
        await expect(control).not.toHaveAttribute('title');
        await control.hover();
        await expect(tooltip).toHaveText(text);
        await expect(tooltip).toHaveClass(/tooltip/);
    }

    const scm = page.getByTestId('scm-pane');
    const settings = scm.getByTestId('scm-settings-button');
    await settings.hover();
    await page.waitForTimeout(350);
    await expect(tooltip).toHaveCount(0);
    await expect(tooltip).toHaveText('Settings (Ctrl+,)');

    const titleActions = scm.getByRole('toolbar', { name: 'Source Control Actions' }).getByRole('button');
    for (const button of await titleActions.all()) {
        const label = await button.getAttribute('aria-label');
        if (!label) {
            throw new Error('Expected an accessible Source Control action label');
        }
        await checkTooltip(button, label === 'Settings' ? 'Settings (Ctrl+,)' : label);
    }

    const group = page.getByTestId('scm-group-working-copy');
    await group.locator('.group-header').hover();
    for (const button of await group.getByRole('toolbar', { name: 'Group Actions' }).getByRole('button').all()) {
        const label = await button.getAttribute('aria-label');
        if (!label) {
            throw new Error('Expected an accessible commit action label');
        }
        await checkTooltip(button, label);
    }

    const file = group.getByTestId('scm-resource-item');
    await file.hover();
    for (const button of await file.getByRole('toolbar', { name: 'File Actions' }).getByRole('button').all()) {
        const label = await button.getAttribute('aria-label');
        if (!label) {
            throw new Error('Expected an accessible file action label');
        }
        await checkTooltip(button, label);
    }
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'source-control-tooltip.png') });
    await checkTooltip(file.locator('.stat-added'), 'Lines added: 1');
    await checkTooltip(file.getByRole('img', { name: 'Modified' }), 'Modified');
    await checkTooltip(scm.getByTestId('agent-draft-button'), 'Draft description with AI agent');
    await expect(scm.locator('[title]:not([title=""])')).toHaveCount(0);

    const collapse = scm.getByTestId('scm-collapse-toggle');
    await checkTooltip(collapse, 'Collapse Source Control');
    await collapse.click();
    await checkTooltip(collapse, 'Expand Source Control');
    await collapse.click();

    await page.locator('.commit-row.working-copy .commit-id').click();
    const details = page.getByTestId('commit-details-view');
    const copyChange = details.getByRole('button', { name: 'Copy Change ID', exact: true });
    await checkTooltip(copyChange, 'Copy Change ID');
    await checkTooltip(details.getByRole('button', { name: 'Copy Commit ID', exact: true }), 'Copy Commit ID');
    await checkTooltip(details.getByRole('link', { name: 'Configure width rulers' }), 'Configure width rulers');
    await checkTooltip(details.locator('.ruler-indicator'), 'Configured rulers for title / body width');
    await checkTooltip(details.getByRole('button', { name: 'Format Body' }), 'No body to format. The first line is the commit title.');
    await checkTooltip(details.getByRole('button', { name: 'Saved', exact: true }), /^\s*Save Changes \(/);
    await checkTooltip(details.getByRole('button', { name: 'Multi-file Diff' }), 'Open diffs for all changed files');
    await checkTooltip(details.locator('.file-path-container'), 'docs/changed.ts');
    await checkTooltip(details.getByRole('img', { name: 'Modified' }), 'modified');
    await checkTooltip(details.locator('.email').first(), '<test@example.com>');
    await checkTooltip(details.locator('.time').first(), /\d{4}/);
    await expect(details.locator('[title]:not([title=""])')).toHaveCount(0);
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'commit-details-tooltip.png') });

    await page.mouse.move(1100, 400);
    await copyChange.focus();
    await expect(tooltip).toHaveText('Copy Change ID');
    await page.keyboard.press('Escape');
    await expect(tooltip).toHaveCount(0);
    const close = details.getByTestId('commit-details-close');
    await checkTooltip(close, 'Close');
    await close.click();
    await expect(page.locator('[role="tooltip"]').filter({ hasText: 'Copy Change ID' })).toHaveCount(0);

    await page.locator(`.commit-row[data-change-id="${rootChange}"] .commit-id`).click();
    await checkTooltip(details.locator('.badge-immutable'), 'This commit cannot be modified');
    await checkTooltip(details.locator('.badge-empty'), 'This commit has no file changes');
});

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
    testRepo.bookmark('feature', '@');
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
        await expect(tooltip.locator('.tooltip-heading')).toHaveClass(/badge/);
        await expect(tooltip).not.toContainText('Immutable');
        await expect(tooltip).not.toContainText('(no description)');
        await expect(tooltip).toHaveCSS('font-size', '14px');
        const badge = tooltip.locator('.tooltip-heading');
        const bookmark = page.locator('.bookmark-wrapper .bookmark-pill', { hasText: 'feature' });
        for (const property of ['font-size', 'font-weight', 'height', 'padding-left', 'padding-right', 'border-radius']) {
            const value = await bookmark.evaluate((el, name) => getComputedStyle(el).getPropertyValue(name), property);
            await expect(badge).toHaveCSS(property, value);
        }
        const background = await tooltip.evaluate(el => getComputedStyle(el).backgroundColor);
        const border = await tooltip.evaluate((el) => getComputedStyle(el).borderTopColor);
        if (theme === 'pierre-dark-cobalt') {
            await expect(badge).toHaveCSS('background-color', 'rgb(35, 134, 54)');
            await expect(badge).toHaveCSS('border-top-color', 'rgb(35, 134, 54)');
            await expect(badge).toHaveCSS('color', 'rgb(255, 255, 255)');
            await expect(tooltip).not.toHaveCSS('border-top-color', 'rgb(7, 196, 128)');
            darkBackground = background;
        } else {
            expect(background).not.toBe(darkBackground);
            await expect(badge).not.toHaveCSS('background-color', 'rgb(35, 134, 54)');
        }
        await page.screenshot({ path: path.join(ARTIFACT_DIR, `graph-tooltip-${theme}.png`) });
        await hoverDot(rootCommit);
        await expect(tooltip).toContainText('Empty commit · Immutable');
        await expect(tooltip.locator('.tooltip-heading')).toHaveCount(0);
        await expect(tooltip).toHaveCSS('background-color', background);
        await expect(tooltip).toHaveCSS('border-top-color', border);
        await hoverDot(featureCommit);
        await expect(tooltip).toContainText('Feature commit');
        await expect(tooltip.locator('.tooltip-heading')).toHaveCount(0);
        await expect(tooltip).toHaveCSS('background-color', background);
        await expect(tooltip).toHaveCSS('border-top-color', border);
        await expect(tooltip).not.toContainText('Empty commit');
        await expect(tooltip).not.toContainText('Immutable');
    }
});
