/**
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { TestRepo } from '../test-repo';
import { ARTIFACT_DIR, expect, type Locator, recordGifFlow, test, waitForScmReady } from './standalone-fixture';

async function textBrightness(locator: Locator): Promise<number> {
    return locator.evaluate((element) => {
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = 1;
        const context = canvas.getContext('2d');
        if (!context) {
            throw new Error('A canvas context is required to compare computed text colors');
        }
        context.fillStyle = getComputedStyle(element).color;
        context.fillRect(0, 0, 1, 1);
        const [r, g, b] = context.getImageData(0, 0, 1, 1).data;
        return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    });
}

test('current commit descriptions stay bright when selection and focus change', async ({ page, server, testRepo }) => {
    testRepo.writeFile('base.txt', 'base\n');
    testRepo.describe('Initial commit');
    testRepo.new();
    testRepo.describe('Plan next change');
    await page.goto(server.serverUrl);
    await waitForScmReady(page);

    const workingRow = page.locator('.commit-row.working-copy');
    const parentRow = page.locator('.commit-row', { hasText: 'Initial commit' });
    const workingDescription = workingRow.locator('.commit-desc');
    const parentDescription = parentRow.locator('.commit-desc');
    for (const theme of ['pierre-dark-cobalt', 'pierre-light']) {
        await page.evaluate(async (value) => {
            await window.__JJ_VIEW_ENV__?.config.update?.('appearance.theme', value);
        }, theme);
        await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
        await workingRow.locator('.commit-id').click();
        await expect(workingRow).toHaveAttribute('aria-selected', 'true');
        await expect(workingDescription).toHaveCSS('font-weight', '500');
        await expect(workingDescription).toHaveCSS('font-style', 'normal');
        const emptyDot = page.locator('.node-working-copy');
        await expect(emptyDot).toHaveCSS(
            'stroke',
            theme === 'pierre-dark-cobalt' ? 'rgb(37, 177, 69)' : 'rgb(24, 164, 108)',
        );
        const graphBackground = await page
            .getByTestId('log-pane')
            .evaluate((el) => getComputedStyle(el).backgroundColor);
        await expect(emptyDot).toHaveCSS('fill', graphBackground);
        const currentSymbol = page.locator('.node-working-copy-symbol');
        await expect(currentSymbol).toHaveText('@');
        await expect(currentSymbol).toHaveCSS('font-size', '10px');
        await expect(currentSymbol).toHaveCSS('fill', await emptyDot.evaluate((el) => getComputedStyle(el).stroke));
        await expect(page.locator('.working-copy-badge')).toHaveCount(0);
        const selectedColor = await workingDescription.evaluate((el) => getComputedStyle(el).color);
        const inactiveColor = await parentDescription.evaluate((el) => getComputedStyle(el).color);
        expect(inactiveColor).not.toBe(selectedColor);

        await parentRow.locator('.commit-id').click();
        await expect(workingRow).toHaveAttribute('aria-selected', 'false');
        await expect(workingDescription).toHaveCSS('color', selectedColor);
        await expect(workingDescription).toHaveCSS('font-weight', '500');
        await expect(workingDescription).toHaveCSS('font-style', 'normal');
        await expect(parentDescription).toHaveCSS('color', selectedColor);
        await expect(parentDescription).toHaveCSS('font-weight', '500');
        await expect(currentSymbol).toBeVisible();
        await page.getByTestId('scm-input-textarea').focus();
        await expect(workingDescription).toHaveCSS('color', selectedColor);
        await expect(parentDescription).toHaveCSS('color', selectedColor);
        await workingRow.hover();
        await expect(workingDescription).toHaveCSS('color', selectedColor);
        await page.mouse.move(1000, 600);
        await expect(workingDescription).toHaveCSS('color', selectedColor);
        await page.screenshot({ path: path.join(ARTIFACT_DIR, `commit-selection-${theme}.png`) });
    }
});

test('Cobalt badges and actions, Silver lanes, and dotted history retain theme and diff behavior', async ({
    page,
    server,
    testRepo,
}) => {
    testRepo.writeFile('base.txt', 'base\n');
    testRepo.describe('Initial commit');
    testRepo.bookmark('devlocal', '@');
    const initialChange = testRepo.getChangeId('@');
    testRepo.new();
    testRepo.writeFile('base.txt', 'hidden intermediate\n');
    testRepo.describe('Hidden intermediate');
    testRepo.new();
    testRepo.writeFile('base.txt', 'remote baseline\n');
    testRepo.describe('Remote baseline');
    const remoteCommit = testRepo.getCommitId('@');
    const remoteChange = testRepo.getChangeId('@');
    testRepo.new();
    testRepo.writeFile('release.txt', 'release candidate\n');
    testRepo.describe('Release candidate');
    const releaseChange = testRepo.getChangeId('@');
    const releaseCommit = testRepo.getCommitId('@');
    testRepo.new();
    testRepo.tag('v1.0.0', remoteChange);
    testRepo.writeFile('working.txt', 'work in progress\n');
    testRepo.describe('Working copy');
    const workingChange = testRepo.getChangeId('@');
    testRepo.addRemote('origin', testRepo.path);
    execFileSync(TestRepo.getGitBinary(), ['update-ref', 'refs/remotes/origin/main', remoteCommit], {
        cwd: testRepo.path,
    });
    testRepo.gitImport();
    const jjConfigDir = path.join(server.userDataDir, 'jj');
    fs.mkdirSync(jjConfigDir, { recursive: true });
    fs.writeFileSync(
        path.join(jjConfigDir, 'config.toml'),
        `[revsets]\nlog = '@ | ${initialChange} | ${remoteChange} | ${releaseChange}'\n`,
    );

    await page.goto(server.serverUrl);
    await waitForScmReady(page);
    await page.evaluate(async () => {
        await window.__JJ_VIEW_ENV__?.config.update?.('appearance.theme', 'pierre-dark-cobalt');
        await window.__JJ_VIEW_ENV__?.config.update?.('logTheme', 'silver');
    });
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'pierre-dark-cobalt');
    await expect(page.getByTestId('log-pane')).toHaveCSS('background-color', 'rgb(0, 0, 0)');
    await expect(page.getByTestId('log-header')).toHaveCSS('background-color', 'rgb(0, 0, 0)');
    await expect(page.getByTestId('scm-input-textarea')).toHaveCSS('background-color', 'rgb(14, 14, 14)');
    await expect(page.getByTestId('scm-input-textarea')).toHaveCSS('font-size', '14px');
    await expect(page.locator('html')).toHaveCSS('font-size', '16px');
    await expect(page.locator('body')).toHaveCSS('-webkit-font-smoothing', 'antialiased');
    await expect(page.locator('.commit-desc').first()).toHaveCSS('font-size', '14px');
    await expect(page.locator('.commit-id').first()).toHaveCSS('font-size', '13px');
    await expect(page.locator('.commit-desc').first()).toHaveCSS('font-family', /Inter Variable/);
    await expect(page.locator('.commit-id').first()).toHaveCSS('font-family', /^"SF Mono"/);
    await page.getByTestId('scm-collapse-toggle').click();

    const graph = page.locator('.commit-graph');
    const local = graph.locator('.bookmark-pill', { hasText: 'devlocal' });
    const remote = graph.locator('.bookmark-pill', { hasText: 'main@origin' });
    const tag = graph.locator('.tag-wrapper .bookmark-pill', { hasText: 'v1.0.0' });
    await expect(local).toHaveCSS('background-color', 'rgb(31, 111, 235)');
    await expect(remote).toHaveCSS('background-color', 'rgb(130, 80, 223)');
    await expect(tag).toHaveCSS('background-color', 'rgb(128, 86, 6)');
    for (const badge of [local, remote, tag]) {
        await expect(badge).toHaveCSS('color', 'rgb(255, 255, 255)');
        await expect(badge).toHaveCSS('border-radius', '4px');
    }
    const current = graph.locator('.node-working-copy');
    const currentId = graph.locator('.commit-row.working-copy .commit-id');
    const immutableId = graph.locator(`[data-change-id="${remoteChange}"] .commit-id`);
    const immutableDiamond = graph.locator(`[data-commit-id="${remoteCommit}"] polygon`);
    const releaseRow = graph.locator('.commit-row', { hasText: 'Release candidate' });
    const releaseDescription = releaseRow.locator('.commit-desc');
    const immutableRow = graph.locator(`.commit-row[data-change-id="${remoteChange}"]`);
    const immutableDescription = immutableRow.locator('.commit-desc');
    const workingDescription = graph.locator('.commit-row.working-copy .commit-desc');
    await graph.locator('.commit-row.working-copy .commit-id').click();
    await expect(graph.locator('.commit-row.working-copy')).toHaveAttribute('aria-selected', 'true');
    await page.mouse.move(1000, 600);
    await expect(releaseRow).toHaveAttribute('data-immutable', 'false');
    await expect(immutableRow).toHaveAttribute('data-immutable', 'true');
    const inactiveColor = await releaseDescription.evaluate((el) => getComputedStyle(el).color);
    const activeColor = await workingDescription.evaluate((el) => getComputedStyle(el).color);
    const immutableTextColor = await immutableDescription.evaluate((el) => getComputedStyle(el).color);
    const inactiveBrightness = await textBrightness(releaseDescription);
    const activeBrightness = await textBrightness(workingDescription);
    expect(await textBrightness(immutableDescription)).toBeLessThan(inactiveBrightness);
    expect(inactiveBrightness).toBeLessThan(activeBrightness);
    const immutableColor = await immutableId.evaluate((el) => getComputedStyle(el).color);
    await expect(currentId).toHaveCSS('color', immutableColor);
    await expect(currentId).not.toHaveCSS('color', 'rgb(37, 177, 69)');
    await expect(current).toHaveCSS('fill', 'rgb(37, 177, 69)');
    await expect(current).toHaveCSS('stroke', 'rgb(37, 177, 69)');
    await expect(immutableDiamond).toHaveCSS('stroke', 'rgb(31, 111, 235)');
    await expect(immutableDiamond).toHaveCSS('fill', 'rgb(31, 111, 235)');
    const olderDiamonds = graph.locator(`g[data-commit-id]:not([data-commit-id="${remoteCommit}"]) > polygon`);
    await expect(olderDiamonds).toHaveCount(1);
    await expect(olderDiamonds).toHaveCSS('fill', immutableTextColor);
    const currentCircles = current.locator('..').locator('circle');
    await expect(currentCircles).toHaveCount(1);
    await expect(current).not.toHaveCSS('filter', 'none');
    await expect(graph.locator('.graph-svg text')).toHaveText('@');
    await expect(graph.locator('.node-working-copy-symbol')).toHaveCSS('fill', 'rgb(255, 255, 255)');
    const currentEdge = graph.locator(`[data-edge-id="${workingChange}->${releaseChange}"]`);
    await expect(currentEdge).toHaveCSS('stroke', 'rgb(37, 177, 69)');
    const defaultBranchEdge = graph.locator(`[data-edge-id^="${remoteChange}->"]`);
    await expect(defaultBranchEdge).toHaveCSS('stroke', 'rgb(31, 111, 235)');
    const termination = graph.locator('.history-termination').first();
    await expect(termination).toBeVisible();
    await expect(termination.locator('.history-dot')).toHaveCount(3);
    await expect(termination.locator('.history-dot').first()).toHaveCSS('fill', inactiveColor);
    const tildeColor = await termination.locator('path').evaluate((el) => getComputedStyle(el).stroke);
    await expect(termination.locator('.history-dot').last()).toHaveCSS('fill', tildeColor);
    await expect(termination.locator('.history-dot').last()).toHaveCSS('opacity', '1');

    const releaseDot = graph.locator(`[data-commit-id="${releaseCommit}"] > .node-mutable`);
    await expect(releaseDot).toHaveCSS('stroke', 'rgb(37, 177, 69)');
    await expect(releaseDot).toHaveCSS('fill', inactiveColor);
    expect(Number(await current.getAttribute('r'))).toBeGreaterThan(Number(await releaseDot.getAttribute('r')));
    const connectedLines = graph.locator(`[data-edge-id^="${releaseChange}->"]`);
    await expect(connectedLines).toHaveCSS('stroke', 'rgb(31, 111, 235)');
    const unrelatedLines = graph.locator(
        `[data-edge-id]:not([data-edge-id^="${releaseChange}->"]):not([data-edge-id$="->${releaseChange}"]):not([data-edge-id^="${remoteChange}->"])`,
    );
    await recordGifFlow(
        page,
        async (capture) => {
            await page.mouse.move(700, 100);
            await capture();
            await releaseRow.hover();
            const hoverColor = await releaseDescription.evaluate((el) => getComputedStyle(el).color);
            const hoverBrightness = await textBrightness(releaseDescription);
            expect(hoverBrightness).toBeGreaterThan(inactiveBrightness);
            expect(hoverBrightness).toBeLessThan(activeBrightness);
            await expect(releaseDot).toHaveCSS('stroke', 'rgb(37, 177, 69)');
            await expect(releaseDot).toHaveCSS('fill', hoverColor);
            await expect(currentEdge).toHaveCSS('stroke', 'rgb(37, 177, 69)');
            await expect(current).toHaveCSS('fill', 'rgb(37, 177, 69)');
            await expect(connectedLines).toHaveCount(1);
            for (const line of await connectedLines.all()) {
                await expect(line).toHaveCSS('stroke', 'rgb(31, 111, 235)');
            }
            for (const line of await unrelatedLines.all()) {
                await expect(line).toHaveCSS('stroke', inactiveColor);
            }
            const actions = releaseRow.locator('.hover-actions');
            await expect(releaseRow).toHaveCSS('background-color', 'rgb(31, 31, 31)');
            await expect(actions).toHaveCSS('background-color', 'rgb(31, 31, 31)');
            await expect(actions.getByRole('button').first()).toHaveCSS('background-color', 'rgb(35, 134, 54)');
            await expect(actions.getByRole('button').first()).toHaveCSS('border-radius', '5px');
            await actions.getByRole('button').first().hover();
            await expect(actions.getByRole('button').first()).toHaveCSS('background-color', 'rgb(45, 160, 68)');
            await page.screenshot({ path: path.join(ARTIFACT_DIR, 'pierre-dark-cobalt.png') });
            await capture();
            await releaseRow.locator('.commit-id').click();
            await expect(releaseDescription).toHaveCSS('color', activeColor);
            await expect(releaseDot).toHaveCSS('stroke', 'rgb(37, 177, 69)');
            await capture();
            await immutableRow.hover();
            await expect(immutableDescription).toHaveCSS('color', hoverColor);
            await expect(immutableDiamond).toHaveCSS('stroke', 'rgb(31, 111, 235)');
            await expect(immutableDiamond).toHaveCSS('fill', 'rgb(31, 111, 235)');
            await expect(defaultBranchEdge).toHaveCSS('stroke', 'rgb(31, 111, 235)');
            await expect(connectedLines).toHaveCSS('stroke', 'rgb(31, 111, 235)');
            await capture();
            await immutableRow.locator('.commit-id').click();
            await expect(immutableDescription).toHaveCSS('color', activeColor);
            await capture();
            await page.mouse.move(1000, 600);
            await expect(immutableDescription).toHaveCSS('color', activeColor);
            await expect(releaseDescription).toHaveCSS('color', inactiveColor);
            await expect(releaseDot).toHaveCSS('stroke', 'rgb(37, 177, 69)');
            await expect(releaseDot).toHaveCSS('fill', inactiveColor);
            await expect(currentEdge).toHaveCSS('stroke', 'rgb(37, 177, 69)');
            for (const line of await connectedLines.all()) {
                await expect(line).toHaveCSS('stroke', 'rgb(31, 111, 235)');
            }
        },
        { outputPath: path.join(ARTIFACT_DIR, 'pierre-dark-cobalt.gif') },
    );

    // The custom theme must also resolve in Pierre's diff highlighter and worker.
    const workingRow = graph.locator('.commit-row.working-copy');
    await workingRow.locator('.commit-id').click();
    await expect(workingRow).toHaveAttribute('aria-selected', 'true');
    await expect(workingRow.locator('.commit-desc')).toHaveCSS('font-weight', '500');
    await expect(workingRow.locator('.commit-desc')).toHaveCSS('font-style', 'normal');
    await releaseRow.locator('.commit-id').click();
    await expect(releaseRow).toHaveAttribute('aria-selected', 'true');
    await expect(releaseRow).toHaveCSS('background-color', 'rgb(31, 31, 31)');
    await expect(releaseRow.locator('.commit-desc')).toHaveCSS('color', 'oklab(0.963762 -0.000504732 -0.00571203)');
    await expect(releaseRow.locator('.commit-desc')).toHaveCSS('font-weight', '500');
    await expect(releaseRow.locator('.commit-desc')).toHaveCSS('font-style', 'normal');
    const toolbarButton = page.locator('.log-toolbar button').first();
    await toolbarButton.hover();
    await expect(toolbarButton).toHaveCSS('background-color', 'rgb(31, 31, 31)');
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'xenon-darc-active-row.png') });
    await page.getByTestId('commit-details-view').locator('.file-row', { hasText: 'release.txt' }).click();
    await expect(
        page.getByTestId('diff-content-container').getByText('release candidate', { exact: true }),
    ).toBeVisible();

    // Switching away must remove custom colors rather than leaking them into other themes.
    await page.evaluate(async () => {
        await window.__JJ_VIEW_ENV__?.config.update?.('appearance.theme', 'pierre-light');
        await window.__JJ_VIEW_ENV__?.config.update?.('logTheme', 'default');
    });
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'pierre-light');
    const lightImmutableColor = await immutableId.evaluate((el) => getComputedStyle(el).color);
    await expect(currentId).toHaveCSS('color', lightImmutableColor);
    await expect(current).toHaveCSS('fill', 'rgb(10, 10, 10)');
    await expect(current).toHaveCSS('stroke', 'rgb(24, 164, 108)');
    const lightDefaultColor = await immutableDiamond.evaluate((el) => getComputedStyle(el).stroke);
    expect(lightDefaultColor).not.toBe(lightImmutableColor);
    await expect(immutableDiamond).toHaveCSS('fill', lightDefaultColor);
    await expect(defaultBranchEdge).toHaveCSS('stroke', lightDefaultColor);
    await expect(connectedLines).toHaveCSS('stroke', lightDefaultColor);
    await expect(olderDiamonds).toHaveCSS('fill', lightImmutableColor);
    await expect(page.getByTestId('log-pane')).not.toHaveCSS('background-color', 'rgb(0, 0, 0)');
    await expect(page.locator('.commit-desc').first()).toHaveCSS('font-size', '13px');
    await expect(page.locator('.commit-id').first()).toHaveCSS('font-size', '12px');
    await expect(page.locator('.commit-desc').first()).not.toHaveCSS('font-family', /Inter Variable/);
    await expect(local).not.toHaveCSS('background-color', 'rgb(31, 111, 235)');
    await expect(graph.locator('.graph-svg > path').first()).not.toHaveCSS('stroke', 'rgb(230, 237, 244)');
    const lightLineColor = await graph
        .locator('.graph-svg > path')
        .first()
        .evaluate((el) => getComputedStyle(el).stroke);
    const lightTildeColor = await termination.locator('path').evaluate((el) => getComputedStyle(el).stroke);
    await expect(termination.locator('.history-dot').first()).toHaveCSS('fill', lightLineColor);
    await expect(termination.locator('.history-dot').last()).toHaveCSS('fill', lightTildeColor);
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'graph-theme-light-fallback.png') });
});
