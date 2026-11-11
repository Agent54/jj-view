/**
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import * as path from 'node:path';
import { ARTIFACT_DIR, expect, recordGifFlow, test, waitForScmReady } from './standalone-fixture';

test.describe('Standalone Web SCM Resources', () => {
    test('should show matching file icons and status glyphs in SCM and commit details', async ({
        page,
        server,
        testRepo,
    }) => {
        // Create initial commit
        testRepo.writeFile('committed.txt', 'hello world\n');
        testRepo.describe('initial commit');
        testRepo.new();

        // Create working copy changes: 1 modified, 1 added
        testRepo.writeFile('committed.txt', 'hello world modified\n');
        testRepo.writeFile('src/components/untracked.ts', 'export const added = true;\n');

        await page.goto(server.serverUrl);
        await waitForScmReady(page);
        await page.evaluate(async () => {
            await window.__JJ_VIEW_ENV__?.config.update?.('appearance.theme', 'pierre-dark-cobalt');
        });

        // Find working copy resource group
        const workingCopyGroup = page.locator('[data-testid="scm-group-working-copy"]');
        await expect(workingCopyGroup).toBeVisible();
        const workingCopyHeader = workingCopyGroup.locator('.group-header');
        await expect(workingCopyHeader.locator('.stat-added')).toHaveText('+2');
        await expect(workingCopyHeader.locator('.stat-deleted')).toHaveText('-1');
        const ancestorGroup = page.getByTestId('scm-group-ancestor-0');
        await expect(ancestorGroup.locator('.group-header .stat-added')).toHaveText('+1');
        await expect(ancestorGroup.locator('.file-diff-stats .stat-added')).toHaveText('+1');

        // Verify modified files use the change glyph.
        const modifiedItem = workingCopyGroup
            .locator('[data-testid="scm-resource-item"]')
            .filter({ hasText: 'committed.txt' });
        await expect(modifiedItem).toBeVisible();
        await expect(modifiedItem.getByRole('img', { name: 'Modified' })).toHaveClass(/codicon-diff-modified/);
        await expect(modifiedItem.locator('.stat-added')).toHaveText('+1');
        await expect(modifiedItem.locator('.stat-deleted')).toHaveText('-1');

        // Verify added files use the addition glyph.
        const addedItem = workingCopyGroup
            .locator('[data-testid="scm-resource-item"]')
            .filter({ hasText: 'untracked.ts' });
        await expect(addedItem).toBeVisible();
        await expect(addedItem.getByRole('img', { name: 'Added' })).toHaveClass(/codicon-diff-added/);
        await expect(addedItem.locator('.stat-added')).toHaveText('+1');
        await expect(addedItem.locator('.stat-deleted')).toHaveCount(0);

        await workingCopyHeader.locator('.chevron-icon').click();
        await expect(modifiedItem).toBeHidden();
        await expect(workingCopyHeader.locator('.stat-added')).toHaveText('+2');
        await expect(workingCopyHeader.locator('.stat-deleted')).toHaveText('-1');
        await workingCopyHeader.locator('.chevron-icon').click();

        await page.locator('.commit-row.working-copy .commit-id').click();
        const details = page.getByTestId('commit-details-view');
        for (const [filename, label, glyph] of [
            ['committed.txt', 'Modified', 'diff-modified'],
            ['untracked.ts', 'Added', 'diff-added'],
        ]) {
            const sourceRow = workingCopyGroup.getByTestId('scm-resource-item').filter({ hasText: filename });
            const detailRow = details.locator('.file-row').filter({ hasText: filename });
            const sourceIcon = sourceRow.getByTestId(`file-icon-${filename}`);
            const detailIcon = detailRow.getByTestId(`file-icon-${filename}`);
            await expect(detailIcon).toBeVisible();
            expect(await detailIcon.innerHTML()).toBe(await sourceIcon.innerHTML());
            await expect(detailRow.locator('.file-meta-group').getByRole('img', { name: label })).toHaveClass(
                new RegExp(`codicon-${glyph}`),
            );
            await expect(detailRow.locator(':scope > .file-icon-wrapper')).toHaveCount(1);
            await expect(detailRow.locator('.file-status-badge')).toHaveText('');
            await expect(sourceRow.locator('.file-diff-stats')).toHaveText(
                await detailRow.locator('.file-diff-stats').innerText(),
            );
            await expect(detailRow.locator('.file-name')).toHaveText(filename);
            await expect(detailRow.locator('.file-name')).toHaveCSS(
                'font-size',
                await sourceRow.locator('.file-name').evaluate((el) => getComputedStyle(el).fontSize),
            );
            if (filename === 'untracked.ts') {
                for (const row of [sourceRow, detailRow]) {
                    await expect(row.locator('.dir-name')).toHaveText('src/components');
                    const nameBox = await row.locator('.file-name').boundingBox();
                    const dirBox = await row.locator('.dir-name').boundingBox();
                    expect(nameBox).not.toBeNull();
                    expect(dirBox).not.toBeNull();
                    expect(dirBox?.x).toBeGreaterThan((nameBox?.x ?? 0) + (nameBox?.width ?? 0));
                }
            } else {
                await expect(detailRow.locator('.dir-name')).toHaveCount(0);
            }
        }
        await page.screenshot({ path: path.join(ARTIFACT_DIR, 'file-status-glyphs.png') });
    });

    test('should display clean working copy when there are no changes', async ({ page, server, testRepo }) => {
        testRepo.writeFile('file.txt', 'content\n');
        testRepo.describe('clean revision');
        testRepo.new();

        await page.goto(server.serverUrl);
        await waitForScmReady(page);

        // Verify working copy has no resource items
        const workingCopyItems = page.locator(
            '[data-testid="scm-group-working-copy"] [data-testid="scm-resource-item"]',
        );
        await expect(workingCopyItems).toHaveCount(0);
    });

    test('should list deleted files with a removal glyph and strikethrough styling', async ({
        page,
        server,
        testRepo,
    }) => {
        testRepo.writeFile('remove-me.txt', 'to be deleted\n');
        testRepo.describe('initial commit');
        testRepo.new();

        // Delete the file from working copy
        testRepo.deleteFile('remove-me.txt');

        await page.goto(server.serverUrl);
        await waitForScmReady(page);

        const workingCopyGroup = page.locator('[data-testid="scm-group-working-copy"]');
        const deletedItem = workingCopyGroup
            .locator('[data-testid="scm-resource-item"]')
            .filter({ hasText: 'remove-me.txt' });

        await expect(deletedItem).toBeVisible();
        await expect(deletedItem.getByRole('img', { name: 'Deleted' })).toHaveClass(/codicon-diff-removed/);
        await expect(deletedItem.locator('.file-name')).toHaveClass(/deleted/);
        await expect(deletedItem.locator('.stat-deleted')).toHaveText('-1');
        await expect(deletedItem.locator('.stat-added')).toHaveCount(0);
        await expect(workingCopyGroup.locator('.group-header .stat-deleted')).toHaveText('-1');
    });

    test('should maintain strict 22px row height and prevent layout shift on hover with baseline alignment', async ({
        page,
        server,
        testRepo,
    }) => {
        testRepo.writeFile('committed.txt', 'hello\n');
        testRepo.describe('initial commit');
        testRepo.new();

        // Create multiple modified/added files including nested paths
        testRepo.writeFile('committed.txt', 'hello updated\n');
        testRepo.writeFile('src/components/button.ts', 'export const button = true;\n');
        testRepo.writeFile('docs/guide/readme.md', '# Readme\n');

        await page.goto(server.serverUrl);
        await waitForScmReady(page);

        const workingCopyGroup = page.locator('[data-testid="scm-group-working-copy"]');
        await expect(workingCopyGroup).toBeVisible();

        const groupHeader = workingCopyGroup.locator('.group-header');
        const headerBox = await groupHeader.boundingBox();
        expect(headerBox).not.toBeNull();
        expect(Math.round(headerBox?.height ?? 0)).toBe(22);

        const items = workingCopyGroup.locator('[data-testid="scm-resource-item"]');
        await expect(items).toHaveCount(3);

        // Verify typography and baseline alignment on nested item
        const nestedItem = items.filter({ hasText: 'button.ts' });
        await expect(nestedItem).toBeVisible();

        const fileName = nestedItem.locator('.file-name');
        const dirName = nestedItem.locator('.dir-name');
        await expect(fileName).toHaveText('button.ts');
        await expect(dirName).toHaveText('src/components');

        // Check font styling: normal weight (400), not bold/semi-bold
        const fileNameWeight = await fileName.evaluate((el) => window.getComputedStyle(el).fontWeight);
        expect(fileNameWeight).toBe('400');

        // Check baseline alignment container style
        const containerAlign = await nestedItem
            .locator('.resource-label-container')
            .evaluate((el) => window.getComputedStyle(el).alignItems);
        expect(containerAlign).toBe('baseline');

        // Measure all items before hover
        const initialBoxes = await Promise.all([
            items.nth(0).boundingBox(),
            items.nth(1).boundingBox(),
            items.nth(2).boundingBox(),
        ]);

        for (const box of initialBoxes) {
            expect(box).not.toBeNull();
            expect(Math.round(box?.height ?? 0)).toBe(22);
        }

        // Capture initial y coordinate of the second and third items
        const item1InitialY = initialBoxes[1]?.y ?? 0;
        const item2InitialY = initialBoxes[2]?.y ?? 0;

        // Hover over the first item
        await items.nth(0).hover();

        // Ensure hover actions are visible
        const hoverActions0 = items.nth(0).locator('.hover-actions');
        await expect(hoverActions0).toBeVisible();

        // Measure item 0 during hover - row height must remain strictly 22px
        const hoveredBox0 = await items.nth(0).boundingBox();
        expect(hoveredBox0).not.toBeNull();
        expect(Math.round(hoveredBox0?.height ?? 0)).toBe(22);

        // Subsequent items must NOT have shifted vertically at all
        const item1HoveredY = (await items.nth(1).boundingBox())?.y ?? 0;
        const item2HoveredY = (await items.nth(2).boundingBox())?.y ?? 0;
        expect(Math.round(item1HoveredY)).toBe(Math.round(item1InitialY));
        expect(Math.round(item2HoveredY)).toBe(Math.round(item2InitialY));

        // Hover over the second item
        await items.nth(1).hover();
        const hoverActions1 = items.nth(1).locator('.hover-actions');
        await expect(hoverActions1).toBeVisible();

        const hoveredBox1 = await items.nth(1).boundingBox();
        expect(hoveredBox1).not.toBeNull();
        expect(Math.round(hoveredBox1?.height ?? 0)).toBe(22);

        // Subsequent item 2 must still NOT have shifted
        const item2HoveredYSecond = (await items.nth(2).boundingBox())?.y ?? 0;
        expect(Math.round(item2HoveredYSecond)).toBe(Math.round(item2InitialY));

        // Capture screenshot of refined SCM pane
        const scmPane = page.locator('[data-testid="scm-pane"]');
        await scmPane.screenshot({
            path: path.join(ARTIFACT_DIR, 'scm-pane-layout.png'),
        });

        // Record animated GIF flow demonstrating hover stability
        await recordGifFlow(
            page,
            async (captureFrame) => {
                // Initial state
                await page.mouse.move(10, 10);
                await captureFrame();

                // Hover first item
                await items.nth(0).hover();
                await page.waitForTimeout(100);
                await captureFrame();

                // Hover second item
                await items.nth(1).hover();
                await page.waitForTimeout(100);
                await captureFrame();

                // Hover third item
                await items.nth(2).hover();
                await page.waitForTimeout(100);
                await captureFrame();

                // Move out
                await page.mouse.move(10, 10);
                await page.waitForTimeout(100);
                await captureFrame();
            },
            {
                outputPath: path.join(ARTIFACT_DIR, 'scm-hover-stability.gif'),
                framerate: 1.5,
                scale: 640,
            },
        );
    });

    test('should render language file icons and status colors accurately', async ({ page, server, testRepo }) => {
        testRepo.writeFile('committed.txt', 'hello\n');
        testRepo.describe('initial commit');
        testRepo.new();

        // Create working copy with different language file types
        testRepo.writeFile('src/App.svelte', '<script>let name = "world";</script>\n<h1>Hello {name}</h1>\n');
        testRepo.writeFile('src/main.ts', 'console.log("hello");\n');
        testRepo.writeFile('src/test/menu-registry.test.ts', 'test("it works", () => {});\n');
        testRepo.writeFile('package.json', '{\n  "name": "app"\n}\n');
        testRepo.writeFile('src/styles/app.css', 'body { color: red; }\n');
        testRepo.writeFile('.github/workflows/ci.yml', 'name: CI\n');

        await page.goto(server.serverUrl);
        await waitForScmReady(page);

        const workingCopyGroup = page.locator('[data-testid="scm-group-working-copy"]');
        await expect(workingCopyGroup).toBeVisible();

        // Verify items are rendered
        const svelteItem = workingCopyGroup
            .locator('[data-testid="scm-resource-item"]')
            .filter({ hasText: 'App.svelte' });
        await expect(svelteItem).toBeVisible();
        await expect(svelteItem.locator('[data-testid="file-icon-App.svelte"] svg')).toBeVisible();

        const testItem = workingCopyGroup
            .locator('[data-testid="scm-resource-item"]')
            .filter({ hasText: 'menu-registry.test.ts' });
        await expect(testItem).toBeVisible();
        await expect(testItem.locator('.file-icon-badge')).toHaveText('TS');

        // Capture screenshot of language file icons in SCM pane
        const scmPane = page.locator('[data-testid="scm-pane"]');
        await scmPane.screenshot({
            path: path.join(ARTIFACT_DIR, 'scm-language-icons.png'),
        });

        // Capture screenshot of full view
        await page.screenshot({
            path: path.join(ARTIFACT_DIR, 'jj-view-full-view.png'),
        });
    });
});
