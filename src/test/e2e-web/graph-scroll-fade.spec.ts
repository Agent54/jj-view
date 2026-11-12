/**
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import * as path from 'node:path';
import {
    ARTIFACT_DIR,
    expect,
    type Locator,
    type Page,
    recordGifFlow,
    test,
    waitForScmReady,
} from './standalone-fixture';

async function expectFades(locator: Locator, start: number, end: number): Promise<void> {
    await expect
        .poll(() =>
            locator.evaluate((element) => {
                const style = getComputedStyle(element);
                return [
                    parseFloat(style.getPropertyValue('--scroll-fade-start')),
                    parseFloat(style.getPropertyValue('--scroll-fade-end')),
                ];
            }),
        )
        .toEqual([start, end]);
    if (start || end) {
        await expect(locator).toHaveCSS('mask-image', /linear-gradient/);
    } else {
        await expect(locator).toHaveCSS('mask-image', 'none');
    }
}

async function resizeSidebar(page: Page, delta: number): Promise<void> {
    const handle = page.locator('[data-testid="split-pane"].horizontal > [data-testid="split-handle"]');
    const box = await handle.boundingBox();
    if (!box) {
        throw new Error('Expected the sidebar resize handle');
    }
    const x = box.x + box.width / 2;
    const y = box.y + box.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + delta, y, { steps: 8 });
    await page.mouse.up();
}

test('graph title fades follow initial layout, native scrolling, resizing, and live descriptions', async ({
    page,
    server,
    testRepo,
}) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    testRepo.writeFile('base.txt', 'base\n');
    testRepo.describe('Brief title');
    const shortChange = testRepo.getChangeId('@');
    const title = 'Keep commit titles readable while scrolling through the entire graph';
    testRepo.new(undefined, title);
    const changeId = testRepo.getChangeId('@');
    testRepo.bookmark('topic', '@');
    testRepo.new();
    await page.clock.install();
    await page.goto(server.serverUrl);
    await waitForScmReady(page);

    const row = page.locator(`.commit-row[data-change-id="${changeId}"]`);
    const description = row.locator('.commit-desc');
    const shortDescription = page.locator(`.commit-row[data-change-id="${shortChange}"] .commit-desc`);
    await expect(description).toHaveText(title);
    await expect(description).toHaveCSS('overflow-x', 'auto');
    await expect(description).toHaveCSS('text-overflow', 'clip');
    await expectFades(description, 0, 24);
    await expectFades(shortDescription, 0, 0);
    await expectFades(page.locator('.commit-row.working-copy .commit-desc'), 0, 0);

    const metadata = await row.locator('.commit-metadata').boundingBox();
    const bookmark = await row.locator('.pills-group').boundingBox();
    const titleWidth = await description.evaluate((element) => element.clientWidth);
    // Use a real wheel gesture over the title, away from the hover toolbar.
    await description.hover({ position: { x: titleWidth - 8, y: 14 } });
    const actions = row.locator('.hover-actions');
    await expect(actions).toBeVisible();
    await page.mouse.wheel(50, 0);
    await expectFades(description, 24, 24);
    await expect(actions).toBeHidden();
    await page.clock.pauseAt(new Date());
    await page.clock.runFor(2000);
    await expect(actions).toBeHidden();
    await expect(actions).toHaveCSS('pointer-events', 'none');
    const descriptionBox = await description.boundingBox();
    if (!descriptionBox) {
        throw new Error('Expected a visible commit description');
    }
    await page.mouse.move(descriptionBox.x + titleWidth - 10, descriptionBox.y + 14);
    await expect(actions).toBeVisible();
    await description.evaluate((element) => {
        element.scrollLeft = 60;
    });
    await expect(actions).toBeHidden();
    await row.focus();
    await page.keyboard.press('Shift');
    await expect(actions).toBeVisible();
    await page.clock.resume();
    expect(await row.locator('.commit-metadata').boundingBox()).toEqual(metadata);
    expect(await row.locator('.pills-group').boundingBox()).toEqual(bookmark);
    await expect(page.locator('.drag-preview-overlay')).toHaveCount(0);

    await page.mouse.move(1200, 200);
    await recordGifFlow(
        page,
        async (capture) => {
            for (const theme of ['pierre-dark-cobalt', 'pierre-light']) {
                await page.evaluate(async (value) => {
                    await window.__JJ_VIEW_ENV__?.config.update?.('appearance.theme', value);
                }, theme);
                for (const [position, start, end] of [
                    [0, 0, 24],
                    [40, 24, 24],
                    [10000, 24, 0],
                ]) {
                    await description.evaluate((element, value) => {
                        element.scrollLeft = value;
                    }, position);
                    await expectFades(description, start, end);
                    await capture();
                }
            }
        },
        { outputPath: path.join(ARTIFACT_DIR, 'graph-title-fades.gif') },
    );

    // Near the boundary the fade gets shorter, then disappears completely.
    await description.evaluate((element) => {
        element.scrollLeft = 5;
    });
    await expectFades(description, 5, 24);
    await description.evaluate((element) => {
        element.scrollLeft = element.scrollWidth;
    });
    await expectFades(description, 24, 0);
    const growth = await description.evaluate((element) => element.scrollWidth - element.clientWidth + 80);
    await resizeSidebar(page, growth);
    await expectFades(description, 0, 0);
    expect(await description.evaluate((element) => element.scrollLeft)).toBe(0);

    // Font metrics can change the content width without changing the viewport.
    const wideViewport = await description.evaluate((element) => element.clientWidth);
    await description.evaluate((element) => {
        element.style.fontSize = '40px';
    });
    await expectFades(description, 0, 24);
    expect(await description.evaluate((element) => element.clientWidth)).toBe(wideViewport);
    await description.evaluate((element) => {
        element.style.removeProperty('font-size');
    });
    await expectFades(description, 0, 0);
    await resizeSidebar(page, -growth);
    await expectFades(description, 0, 24);

    // Live updates also replace graph rows; each new action must measure on mount.
    testRepo.describe('Short now', changeId);
    await expect(description).toHaveText('Short now');
    await expectFades(description, 0, 0);
    testRepo.describe(title, changeId);
    await expect(description).toHaveText(title);
    await expectFades(description, 0, 24);
    await row.locator('.commit-id').click();
    await expect(row).toHaveAttribute('aria-selected', 'true');
});

test('graph list fades track vertical scrolling, pane resizing, reopening, and content growth', async ({
    page,
    server,
    testRepo,
}) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    testRepo.config('revsets.log', 'all()');
    testRepo.writeFile('base.txt', 'base\n');
    testRepo.describe('Base commit');
    const baseChange = testRepo.getChangeId('@');
    for (let i = 0; i < 18; i++) {
        testRepo.new(undefined, `History row ${i}`);
    }
    await page.goto(server.serverUrl);
    await waitForScmReady(page);
    const scroller = page.getByTestId('log-content').locator('.scroll-container');
    await expectFades(scroller, 0, 24);

    // Vertical wheel gestures over a nested title must still scroll the list.
    const title = page.locator('.commit-row.working-copy .commit-desc');
    await title.hover();
    await page.mouse.wheel(0, 40);
    await expectFades(scroller, 24, 24);
    expect(await title.evaluate((element) => element.scrollLeft)).toBe(0);
    await page.mouse.move(1100, 200);
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'graph-list-fades-middle.png') });
    await scroller.evaluate((element) => {
        element.scrollTop = element.scrollHeight;
    });
    await expectFades(scroller, 24, 0);
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'graph-list-fades-end.png') });

    await page.getByTestId('scm-collapse-toggle').click();
    await expectFades(scroller, 0, 0);
    await page.getByTestId('scm-collapse-toggle').click();
    await expectFades(scroller, 0, 24);
    await page.getByTestId('log-collapse-toggle').click();
    await page.getByTestId('log-collapse-toggle').click();
    await expectFades(scroller, 0, 24);

    const oldHeight = await scroller.evaluate((element) => element.scrollHeight);
    testRepo.new(undefined, 'New history row');
    await expect(page.locator('.commit-row.working-copy .commit-desc')).toHaveText('New history row');
    await expect.poll(() => scroller.evaluate((element) => element.scrollHeight)).toBeGreaterThan(oldHeight);
    await expectFades(scroller, 0, 24);
    await scroller.evaluate((element) => {
        element.scrollTop = element.scrollHeight;
    });
    await expectFades(scroller, 24, 0);
    await scroller.evaluate((element) => {
        element.scrollTop = 0;
    });
    await expectFades(scroller, 0, 24);

    // Removing history must clear both fades without another scroll gesture.
    testRepo.abandon(`descendants(${baseChange}) ~ ${baseChange}`);
    await expect(page.locator('.commit-row')).toHaveCount(3);
    await expectFades(scroller, 0, 0);
});
