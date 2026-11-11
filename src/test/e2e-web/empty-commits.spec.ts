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
    testRepo.describe('Named empty commit');
    const namedChange = testRepo.getChangeId('@');
    const namedCommit = testRepo.getCommitId('@');
    testRepo.new();
    const currentChange = testRepo.getChangeId('@');

    await page.goto(server.serverUrl);
    await waitForScmReady(page);
    const graph = page.locator('.commit-graph');
    const namedRow = graph.locator(`[data-change-id="${namedChange}"]`);
    const currentRow = graph.locator(`[data-change-id="${currentChange}"]`);
    await expect(namedRow.locator('.commit-desc')).toHaveText('Named empty commit');
    await expect(currentRow.locator('.commit-desc')).toHaveText('');
    await expect(graph).not.toContainText('(empty)');
    await expect(graph).not.toContainText('(no description)');
    await expect(currentRow.locator('.commit-desc')).not.toHaveAttribute('title', /no description/);

    for (const theme of ['pierre-dark-cobalt', 'pierre-light']) {
        await page.evaluate(async (value) => {
            await window.__JJ_VIEW_ENV__?.config.update?.('appearance.theme', value);
        }, theme);
        const background = await page.getByTestId('log-pane').evaluate((el) => getComputedStyle(el).backgroundColor);
        await expect(graph.locator('.node-working-copy.empty')).toHaveCSS('fill', background);
        await expect(graph.locator('.node-working-copy.empty')).not.toHaveCSS('stroke', 'none');
        await expect(graph.locator(`[data-commit-id="${namedCommit}"] circle`).last()).toHaveCSS('fill', background);
        await page.screenshot({ path: path.join(ARTIFACT_DIR, `empty-commits-${theme}.png`) });
    }

    testRepo.writeFile('working.txt', 'now nonempty\n');
    await expect(graph.locator('.node-working-copy')).not.toHaveClass(/empty/);
    await expect(currentRow.locator('.commit-desc')).toHaveText('');
});
