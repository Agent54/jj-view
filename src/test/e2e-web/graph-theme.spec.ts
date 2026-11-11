/**
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { TestRepo } from '../test-repo';
import { ARTIFACT_DIR, expect, recordGifFlow, test, waitForScmReady } from './standalone-fixture';

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
    testRepo.new();
    testRepo.tag('v1.0.0', '@-');
    testRepo.writeFile('working.txt', 'work in progress\n');
    testRepo.describe('Working copy');
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
    await expect(local).toHaveCSS('background-color', 'rgb(31, 112, 235)');
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
    const immutableColor = await immutableId.evaluate((el) => getComputedStyle(el).color);
    await expect(currentId).toHaveCSS('color', immutableColor);
    await expect(currentId).not.toHaveCSS('color', 'rgb(7, 196, 128)');
    await expect(current).toHaveCSS('fill', 'rgb(230, 237, 244)');
    await expect(current).toHaveCSS('stroke', 'rgb(7, 196, 128)');
    await expect(immutableDiamond).toHaveCSS('stroke', immutableColor);
    await expect(immutableDiamond).toHaveCSS('fill', immutableColor);
    await expect(current).not.toHaveCSS('filter', 'none');
    await expect(graph.locator('.graph-svg text')).toHaveCount(0);
    await expect(graph.locator('.graph-svg > path').first()).toHaveCSS('stroke', 'rgb(230, 237, 244)');
    const termination = graph.locator('.history-termination').first();
    await expect(termination).toBeVisible();
    await expect(termination.locator('.history-dot')).toHaveCount(3);
    await expect(termination.locator('.history-dot').first()).toHaveCSS('fill', 'rgb(230, 237, 244)');
    const tildeColor = await termination.locator('path').evaluate((el) => getComputedStyle(el).stroke);
    await expect(termination.locator('.history-dot').last()).toHaveCSS('fill', tildeColor);
    await expect(termination.locator('.history-dot').last()).toHaveCSS('opacity', '1');

    const releaseRow = graph.locator('.commit-row', { hasText: 'Release candidate' });
    await recordGifFlow(
        page,
        async (capture) => {
            await page.mouse.move(700, 100);
            await capture();
            await releaseRow.hover();
            const actions = releaseRow.locator('.hover-actions');
            await expect(releaseRow).toHaveCSS('background-color', 'rgb(31, 31, 31)');
            await expect(actions).toHaveCSS('background-color', 'rgb(31, 31, 31)');
            await expect(actions.getByRole('button').first()).toHaveCSS('background-color', 'rgb(35, 134, 54)');
            await expect(actions.getByRole('button').first()).toHaveCSS('border-radius', '5px');
            await actions.getByRole('button').first().hover();
            await expect(actions.getByRole('button').first()).toHaveCSS('background-color', 'rgb(45, 160, 68)');
            await page.screenshot({ path: path.join(ARTIFACT_DIR, 'pierre-dark-cobalt.png') });
            await capture();
        },
        { outputPath: path.join(ARTIFACT_DIR, 'pierre-dark-cobalt.gif') },
    );

    // The custom theme must also resolve in Pierre's diff highlighter and worker.
    const workingRow = graph.locator('.commit-row.working-copy');
    await workingRow.locator('.commit-id').click();
    await expect(workingRow).toHaveAttribute('aria-selected', 'true');
    await expect(workingRow.locator('.commit-desc')).toHaveCSS('font-weight', '400');
    await expect(workingRow.locator('.commit-desc')).toHaveCSS('font-style', 'normal');
    await releaseRow.locator('.commit-id').click();
    await expect(releaseRow).toHaveAttribute('aria-selected', 'true');
    await expect(releaseRow).toHaveCSS('background-color', 'rgb(31, 31, 31)');
    await expect(releaseRow.locator('.commit-desc')).toHaveCSS('color', 'rgb(241, 243, 247)');
    await expect(releaseRow.locator('.commit-desc')).toHaveCSS('font-weight', '400');
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
    await expect(immutableDiamond).toHaveCSS('stroke', lightImmutableColor);
    await expect(immutableDiamond).toHaveCSS('fill', lightImmutableColor);
    await expect(page.getByTestId('log-pane')).not.toHaveCSS('background-color', 'rgb(0, 0, 0)');
    await expect(page.locator('.commit-desc').first()).toHaveCSS('font-size', '13px');
    await expect(page.locator('.commit-id').first()).toHaveCSS('font-size', '12px');
    await expect(page.locator('.commit-desc').first()).not.toHaveCSS('font-family', /Inter Variable/);
    await expect(local).not.toHaveCSS('background-color', 'rgb(31, 112, 235)');
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
