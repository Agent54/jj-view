/**
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import * as path from 'node:path';
import { ARTIFACT_DIR, expect, recordGifFlow, test, waitForScmReady } from './standalone-fixture';

test('commit type glyphs stay monochrome and reveal full prefixes in tooltips', async ({ page, server, testRepo }) => {
    const titles = [
        { prefix: 'feat(ui)!:', text: 'Add compact navigation' },
        { prefix: 'chore:', text: 'Update dependencies' },
        { prefix: 'test:', text: 'Cover keyboard navigation' },
        { prefix: 'fix:', text: 'Keep selection after refresh' },
        { prefix: 'hotfix:', text: 'Restore startup' },
    ];
    for (const title of titles) {
        testRepo.describe(`${title.prefix} ${title.text}`);
        testRepo.new();
    }
    testRepo.describe('docs: explain the fix');

    await page.goto(server.serverUrl);
    await waitForScmReady(page);
    await expect(page.locator('.commit-type-glyph')).toHaveCount(5);
    await expect(page.locator('.commit-row.working-copy .commit-desc')).toHaveText('docs: explain the fix');

    await recordGifFlow(
        page,
        async (capture) => {
            for (const theme of ['pierre-dark-cobalt', 'pierre-light']) {
                await page.evaluate(async (value) => {
                    await window.__JJ_VIEW_ENV__?.config.update?.('appearance.theme', value);
                }, theme);
                await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
                await page.mouse.move(1100, 600);
                await capture();
                await page.screenshot({ path: path.join(ARTIFACT_DIR, `commit-types-${theme}.png`) });

                for (const title of titles) {
                    const row = page.locator('.commit-row', { hasText: title.text });
                    const description = row.locator('.commit-desc');
                    const glyph = row.getByRole('img', { name: title.prefix, exact: true });
                    await expect(description).toHaveText(title.text);
                    await expect(glyph).toHaveCSS('width', '14px');
                    await glyph.hover();
                    await expect(page.getByRole('tooltip', { name: title.prefix, exact: true })).toBeVisible();
                    const textColor = await description.evaluate((el) => getComputedStyle(el).color);
                    await expect(glyph.locator('svg')).toHaveCSS('stroke', textColor);
                    await capture();
                }
                await page.screenshot({ path: path.join(ARTIFACT_DIR, `commit-types-${theme}-tooltip.png`) });
            }
        },
        { outputPath: path.join(ARTIFACT_DIR, 'commit-types.gif') },
    );

    testRepo.describe('feat(core): Handle refreshed titles');
    const current = page.locator('.commit-row.working-copy');
    await expect(current.getByRole('img', { name: 'feat(core):', exact: true })).toBeVisible();
    testRepo.describe('Plain title again');
    await expect(current.locator('.commit-type-glyph')).toHaveCount(0);
    await expect(current.locator('.commit-desc')).toHaveText('Plain title again');
});
