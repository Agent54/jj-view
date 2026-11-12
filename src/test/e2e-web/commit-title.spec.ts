/**
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import * as path from 'node:path';
import { ARTIFACT_DIR, expect, recordGifFlow, test, waitForScmReady } from './standalone-fixture';

test('commit type glyphs stay monochrome and share the main row tooltip', async ({ page, server, testRepo }) => {
    const titles = [
        { prefix: 'feat(ui)!:', tooltip: 'feat(ui)!', text: 'Add compact navigation' },
        { prefix: 'chore:', tooltip: 'chore', text: 'Update dependencies' },
        { prefix: 'test:', tooltip: 'test', text: 'Cover keyboard navigation' },
        { prefix: 'fix:', tooltip: 'fix', text: 'Keep selection after refresh' },
        { prefix: 'hotfix:', tooltip: 'hotfix', text: 'Restore startup' },
        { prefix: 'style(ui):', tooltip: 'style(ui)', text: 'Refine title spacing' },
        { prefix: 'refactor(core):', tooltip: 'refactor(core)', text: 'Simplify title rendering' },
        { prefix: 'ui:', tooltip: 'ui', text: 'Align the navigation panels' },
    ];
    const body = 'Details remain in the shared tooltip.';
    for (const title of titles) {
        testRepo.describe(`${title.prefix} ${title.text}\n\n${body}`);
        testRepo.new();
    }
    testRepo.describe('docs: explain the fix');

    await page.goto(server.serverUrl);
    await waitForScmReady(page);
    await expect(page.locator('.commit-type-glyph')).toHaveCount(8);
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
                    const tooltip = page.getByRole('tooltip');
                    await expect(tooltip).toHaveCount(1);
                    await expect(tooltip).toBeVisible();
                    const tooltipId = (await row.getAttribute('aria-describedby')) ?? '';
                    await expect(tooltip).toHaveAttribute('id', tooltipId);
                    const tooltipTitle = tooltip.locator('.commit-tooltip-title');
                    await expect(tooltipTitle).toHaveText(`${title.prefix} ${title.text}`);
                    await expect(tooltip.getByText(title.tooltip, { exact: true })).toHaveCount(0);
                    await expect(tooltip).toContainText('ᴄʜᴀɴɢᴇ:');
                    await expect(tooltip).toContainText(body);
                    await expect(tooltipTitle.locator('path')).toHaveAttribute(
                        'd',
                        (await glyph.locator('path').getAttribute('d')) ?? '',
                    );
                    const textColor = await description.evaluate((el) => getComputedStyle(el).color);
                    await expect(glyph.locator('svg')).toHaveCSS('fill', textColor);
                    await expect(glyph.locator('svg')).toHaveCSS('stroke', 'none');
                    await capture();
                    await row.locator('.commit-id').hover();
                    await expect(tooltip).toHaveAttribute('id', tooltipId);
                    await expect(tooltipTitle).toHaveText(`${title.prefix} ${title.text}`);
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
