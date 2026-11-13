/**
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import * as path from 'node:path';
import { ARTIFACT_DIR, expect, recordGifFlow, test, waitForScmReady } from './standalone-fixture';

test('creates a tag on the clicked revision and displays it in the graph', async ({ page, server, testRepo }) => {
    testRepo.writeFile('release.txt', 'release content\n');
    testRepo.describe('Release candidate');
    const target = testRepo.getCommitId('@');
    testRepo.new();
    testRepo.describe('Next release');

    await page.goto(server.serverUrl);
    await waitForScmReady(page);

    const releaseRow = page.locator('.commit-row').filter({ hasText: 'Release candidate' }).first();
    await expect(releaseRow).toBeVisible();

    await recordGifFlow(
        page,
        async (capture) => {
            await releaseRow.click({ button: 'right' });
            const createTag = page.getByTestId('menu-item-jj-view.createTag');
            await expect(createTag).toBeVisible();
            await capture();
            await createTag.click();

            const input = page.getByTestId('quick-input-text-input');
            await expect(input).toBeVisible();
            await input.fill('v1.0.0');
            await capture();
            await input.press('Enter');

            await expect(page.getByTestId('quick-input-widget')).not.toBeVisible();
            await expect(releaseRow.locator('.pill-label', { hasText: 'v1.0.0' })).toBeVisible();
            expect(testRepo.getCommitId('v1.0.0')).toBe(target);
            await page.screenshot({ path: path.join(ARTIFACT_DIR, 'create-tag.png') });
            await capture();

            await page.evaluate(async () => {
                await window.__JJ_VIEW_ENV__?.config.update?.('appearance.theme', 'pierre-light');
            });
            await expect(page.locator('html')).toHaveAttribute('data-theme', 'pierre-light');
            await expect(releaseRow.locator('.pill-label', { hasText: 'v1.0.0' })).toBeVisible();
            await page.screenshot({ path: path.join(ARTIFACT_DIR, 'create-tag-light.png') });
            await capture();
        },
        { outputPath: path.join(ARTIFACT_DIR, 'create-tag.gif') },
    );
});

test('deletes a tag from its badge context menu without deleting a same-named bookmark', async ({
    page,
    server,
    testRepo,
}) => {
    testRepo.writeFile('release.txt', 'release content\n');
    testRepo.describe('Release candidate');
    testRepo.new();
    testRepo.bookmark('v1.0.0', '@-');
    testRepo.tag('v1.0.0', '@-');
    testRepo.tag('v2.0.0', '@-');

    await page.goto(server.serverUrl);
    await waitForScmReady(page);

    const releaseRow = page.locator('.commit-row').filter({ hasText: 'Release candidate' }).first();
    const tag = releaseRow.locator('.tag-wrapper').filter({ hasText: 'v1.0.0' });
    const bookmark = releaseRow.locator('.bookmark-wrapper').filter({ hasText: 'v1.0.0' });
    await expect(tag).toBeVisible();

    await tag.click({ button: 'right' });
    const deleteTag = page.getByTestId('menu-item-jj-view.deleteTag');
    await expect(deleteTag).toBeVisible();
    await expect(page.getByTestId('menu-item-jj-view.deleteBookmark')).not.toBeVisible();
    await expect(page.getByTestId('menu-item-jj-view.createTag')).not.toBeVisible();
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'delete-tag-menu.png') });
    await deleteTag.click();

    await expect(tag).toHaveCount(0);
    await expect(bookmark).toBeVisible();
    await expect(releaseRow.locator('.tag-wrapper').filter({ hasText: 'v2.0.0' })).toBeVisible();
    expect(testRepo.getBookmarks('@-')).toContain('v1.0.0');

    await bookmark.click({ button: 'right' });
    await expect(page.getByTestId('menu-item-jj-view.deleteBookmark')).toBeVisible();
    await expect(page.getByTestId('menu-item-jj-view.deleteTag')).not.toBeVisible();
});
