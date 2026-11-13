/**
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import * as path from 'node:path';
import { ARTIFACT_DIR, expect, test, waitForScmReady } from './standalone-fixture';

test('empty commits have outlined nodes and blank descriptions without placeholders', async ({
    page,
    server,
    testRepo,
}) => {
    testRepo.writeFile('base.txt', 'base\n');
    testRepo.describe('Nonempty commit');
    testRepo.new();
    testRepo.describe('Immutable empty commit');
    const immutableCommit = testRepo.getCommitId('@');
    const immutableChange = testRepo.getChangeId('@');
    testRepo.new();
    testRepo.describe('Named empty commit');
    const namedChange = testRepo.getChangeId('@');
    const namedCommit = testRepo.getCommitId('@');
    testRepo.new();
    const currentChange = testRepo.getChangeId('@');
    testRepo.tag('v0.1.0', immutableChange);

    await page.goto(server.serverUrl);
    await waitForScmReady(page);
    const graph = page.locator('.commit-graph');
    const namedRow = graph.locator(`[data-change-id="${namedChange}"]`);
    const currentRow = graph.locator(`[data-change-id="${currentChange}"]`);
    const immutableRow = graph.locator(`[data-change-id="${immutableChange}"]`);
    await expect(namedRow.locator('.commit-desc')).toHaveText('Named empty commit');
    await expect(currentRow.locator('.commit-desc')).toHaveText('');
    await expect(graph).not.toContainText('(empty)');
    await expect(graph).not.toContainText('(no description)');
    await expect(currentRow.locator('.commit-desc')).not.toHaveAttribute('title', /no description/);

    for (const theme of ['pierre-dark-cobalt', 'pierre-light']) {
        await page.evaluate(async (value) => {
            await window.__JJ_VIEW_ENV__?.config.update?.('appearance.theme', value);
            await window.__JJ_VIEW_ENV__?.config.update?.('logTheme', 'silver');
        }, theme);
        const background = await page.getByTestId('log-pane').evaluate((el) => getComputedStyle(el).backgroundColor);
        const gray = await immutableRow.locator('.commit-id').evaluate((el) => getComputedStyle(el).color);
        const green = theme === 'pierre-dark-cobalt' ? 'rgb(7, 196, 128)' : 'rgb(24, 164, 108)';
        await expect(currentRow.locator('.commit-id')).toHaveCSS('color', gray);
        await expect(namedRow.locator('.commit-id')).toHaveCSS('color', gray);
        await expect(graph.locator('.node-working-copy.empty')).toHaveCSS('fill', background);
        await expect(graph.locator('.node-working-copy.empty')).toHaveCSS('stroke', green);
        await expect(graph.locator(`[data-commit-id="${namedCommit}"] circle`).last()).toHaveCSS('fill', background);
        await expect(graph.locator(`[data-commit-id="${namedCommit}"] circle`).last()).toHaveCSS('stroke', green);
        await expect(graph.locator(`[data-commit-id="${immutableCommit}"] polygon`)).toHaveCSS('fill', background);
        await expect(graph.locator(`[data-commit-id="${immutableCommit}"] polygon`)).toHaveCSS('stroke', gray);
        await page.screenshot({ path: path.join(ARTIFACT_DIR, `empty-commits-${theme}.png`) });
    }

    testRepo.writeFile('working.txt', 'now nonempty\n');
    await expect(graph.locator('.node-working-copy')).not.toHaveClass(/empty/);
    await expect(currentRow.getByRole('img', { name: '1 file added', exact: true })).toBeVisible();
});

test('commits without descriptions show muted file counts that gain color on hover and focus', async ({
    page,
    server,
    testRepo,
}) => {
    testRepo.writeFile('modified.txt', 'original\n');
    testRepo.writeFile('deleted-a.txt', 'remove a\n');
    testRepo.writeFile('deleted-b.txt', 'remove b\n');
    testRepo.describe('Named baseline');
    testRepo.new();
    testRepo.writeFile('modified.txt', 'updated\n');
    testRepo.writeFile('added-a.txt', 'new a\n');
    testRepo.writeFile('added-b.txt', 'new b\n');
    testRepo.deleteFile('deleted-a.txt');
    testRepo.deleteFile('deleted-b.txt');
    const undescribedChange = testRepo.getChangeId('@');
    testRepo.new();

    await page.goto(server.serverUrl);
    await waitForScmReady(page);
    const row = page.locator(`.commit-row[data-change-id="${undescribedChange}"]`);
    const summary = row.locator('.commit-file-summary');
    await expect(summary).toBeVisible();
    await expect(page.locator('.commit-row.working-copy .commit-file-summary')).toHaveCount(0);
    await expect(
        page.locator('.commit-row', { hasText: 'Named baseline' }).locator('.commit-file-summary'),
    ).toHaveCount(0);

    const added = summary.getByRole('img', { name: '2 files added', exact: true });
    const modified = summary.getByRole('img', { name: '1 file modified', exact: true });
    const deleted = summary.getByRole('img', { name: '2 files deleted', exact: true });
    await expect(added.locator('.codicon')).toHaveClass(/codicon-diff-added/);
    await expect(modified.locator('.codicon')).toHaveClass(/codicon-diff-modified/);
    await expect(deleted.locator('.codicon')).toHaveClass(/codicon-diff-removed/);

    for (const theme of ['pierre-dark-cobalt', 'pierre-light']) {
        await page.mouse.move(1100, 400);
        await page.evaluate(async (value) => {
            await window.__JJ_VIEW_ENV__?.config.update?.('appearance.theme', value);
        }, theme);
        await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
        const muted = await row.locator('.commit-id').evaluate((el) => getComputedStyle(el).color);
        await expect(summary).toHaveCSS('opacity', '0.55');
        for (const count of [added, modified, deleted]) {
            await expect(count).toHaveCSS('color', muted);
        }
        await page.screenshot({ path: path.join(ARTIFACT_DIR, `file-summary-${theme}.png`) });

        const idBeforeHover = await row.locator('.commit-id').boundingBox();
        await row.hover();
        await expect(summary).toHaveCSS('opacity', '1');
        const source = page.getByTestId('scm-group-ancestor-0');
        for (const status of ['added', 'modified', 'deleted']) {
            const color = await source
                .locator(`.status-${status}`)
                .first()
                .evaluate((el) => getComputedStyle(el).color);
            await expect(summary.locator(`.file-count-${status}`)).toHaveCSS('color', color);
        }
        const actionsBox = await row.locator('.hover-actions').boundingBox();
        const summaryBox = await summary.boundingBox();
        const idAfterHover = await row.locator('.commit-id').boundingBox();
        if (!actionsBox || !summaryBox || !idBeforeHover || !idAfterHover) {
            throw new Error('Expected visible actions, file counts, and change ID');
        }
        expect(summaryBox.x).toBeGreaterThan(actionsBox.x + actionsBox.width);
        expect(idAfterHover.x).toBeCloseTo(idBeforeHover.x, 1);
        await page.screenshot({ path: path.join(ARTIFACT_DIR, `file-summary-${theme}-hover.png`) });

        await page.mouse.move(1100, 400);
        await row.focus();
        await expect(summary).toHaveCSS('opacity', '1');
        await expect(added).not.toHaveCSS('color', muted);
        await row.evaluate((el) => el.blur());
    }
});
